import { cop } from "remix/middleware/cop";
import { createController } from "remix/router";

import { getAllExams } from "../../data/exams/index.ts";
import { unitBasedTabs } from "../../data/units.ts";
import {
	ChallengeConflictError,
	createSyncLink,
	deleteSyncLink,
	SyncLinkNotFoundError,
	syncChallenges,
	syncProgress,
} from "../../db/progress.ts";
import { getDatabase, getRateLimiter } from "../../db/registry.ts";
import type { CompletedChallengePayload } from "../../features/challenge/types.ts";
import { CompletedChallengesRequestSchema } from "../../features/challenge/wire.ts";
import { systemClock } from "../../lib/dateTime.ts";
import { generateSyncKey } from "../../lib/syncKey.ts";
import { type SyncLinkId, syncLinkIdFromSyncKey } from "../../lib/syncLinkId.ts";
import { isPlausibleSyncTimeRange } from "../../lib/syncTime.ts";
import { routes } from "../../routes.ts";
import { ProgressSyncRequestSchema, SyncKeySchema } from "../../types/index.ts";

const RATE_LIMITED = { error: "Too many requests" };
const UNKNOWN_LINK = { error: "Sync link not found" };
const INVALID_PROGRESS = { error: "Unknown question or unit" };
const CONFLICT = { error: "Challenge already exists with different data" };
const INTERNAL_ERROR = { error: "Internal server error" };

const MAX_BODY_BYTES = 512 * 1024;

type ProgressCatalog = Readonly<{
	validProgressKeys: ReadonlySet<string>;
	questionIdsByExam: ReadonlyMap<string, readonly string[]>;
}>;

let catalogPromise: Promise<ProgressCatalog> | undefined;

async function buildCatalog(): Promise<ProgressCatalog> {
	const exams = await getAllExams();
	const byNumber = new Map(exams.map((exam) => [exam.examNumber, exam]));
	const validProgressKeys = new Set(
		unitBasedTabs.flatMap((unit) =>
			unit.examMapping.flatMap((mapping) =>
				mapping.examNumbers.flatMap((examNumber) => {
					const exam = byNumber.get(examNumber)?.exams[mapping.year];
					return (exam?.questions ?? []).map((question) => `${question.id}|${unit.id}`);
				}),
			),
		),
	);
	const questionIdsByExam = new Map(
		exams.flatMap((examByYear) =>
			Object.values(examByYear.exams).flatMap((exam) =>
				exam ? [[exam.id, exam.questions.map((question) => question.id)] as const] : [],
			),
		),
	);
	return { validProgressKeys, questionIdsByExam };
}

function getCatalog(): Promise<ProgressCatalog> {
	catalogPromise ??= buildCatalog();
	return catalogPromise;
}

function isValidChallengeShape(
	payload: CompletedChallengePayload,
	examQuestionIds: ReadonlyMap<string, readonly string[]>,
): boolean {
	const expected = examQuestionIds.get(payload.examId);
	if (!expected || payload.answers.length === 0) {
		return false;
	}
	const questionIds = payload.answers.map((answer) => answer.questionId);
	const expectedSet = new Set(expected);
	const answerSet = new Set(questionIds);
	const isSingleQuestion =
		answerSet.size === 1 && questionIds.every((questionId) => expectedSet.has(questionId));
	return (
		answerSet.size === questionIds.length &&
		(isSingleQuestion ||
			(answerSet.size === expectedSet.size &&
				questionIds.every((questionId) => expectedSet.has(questionId))))
	);
}

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isAllowed(key: string): Promise<boolean> {
	const limiter = getRateLimiter();
	if (!limiter) {
		return true;
	}
	const result = await limiter.limit({ key });
	return result.success;
}

async function resolveSyncLink(request: Request): Promise<SyncLinkId | null> {
	const raw = request.headers.get("x-sync-key");
	const parsed = SyncKeySchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}
	return syncLinkIdFromSyncKey(parsed.data);
}

async function readJsonBody(request: Request): Promise<unknown | null> {
	const length = Number(request.headers.get("content-length") ?? "0");
	if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
		return null;
	}
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export default createController(routes.progress, {
	middleware: [cop()],

	actions: {
		async links(context) {
			const db = getDatabase();
			if (!db) {
				return json(INTERNAL_ERROR, 500);
			}

			const ipAddress = context.request.headers.get("cf-connecting-ip") ?? "unknown";
			if (!(await isAllowed(`issue:${await sha256Hex(ipAddress)}`))) {
				return json(RATE_LIMITED, 429);
			}

			const syncKey = generateSyncKey();
			const createdAt = systemClock.nowEpochMilliseconds();
			await createSyncLink(db, await syncLinkIdFromSyncKey(syncKey), createdAt);
			return json({ key: syncKey }, 201);
		},

		async sync(context) {
			const db = getDatabase();
			if (!db) {
				return json(INTERNAL_ERROR, 500);
			}

			const syncLink = await resolveSyncLink(context.request);
			if (!syncLink) {
				return json(UNKNOWN_LINK, 404);
			}
			if (!(await isAllowed(`sync:${syncLink}`))) {
				return json(RATE_LIMITED, 429);
			}

			const body = await readJsonBody(context.request);
			const parsed = ProgressSyncRequestSchema.safeParse(body);
			if (!parsed.success) {
				return json(UNKNOWN_LINK, 404);
			}

			const submitted = parsed.data.entries;
			const now = systemClock.nowEpochMilliseconds();
			if (
				!submitted.every((entry) => isPlausibleSyncTimeRange(entry.createdAt, entry.updatedAt, now))
			) {
				return json(INVALID_PROGRESS, 400);
			}

			const { validProgressKeys } = await getCatalog();
			if (
				submitted.some((entry) => !validProgressKeys.has(`${entry.questionId}|${entry.unitId}`))
			) {
				return json(INVALID_PROGRESS, 400);
			}

			try {
				const entries = await syncProgress(db, syncLink, submitted);
				return json({ entries });
			} catch (error) {
				if (error instanceof SyncLinkNotFoundError) {
					return json(UNKNOWN_LINK, 404);
				}
				console.error("syncProgress failed", error);
				return json(INTERNAL_ERROR, 500);
			}
		},

		async challenges(context) {
			const db = getDatabase();
			if (!db) {
				return json(INTERNAL_ERROR, 500);
			}

			const syncLink = await resolveSyncLink(context.request);
			if (!syncLink) {
				return json(UNKNOWN_LINK, 404);
			}
			if (!(await isAllowed(`sync:${syncLink}`))) {
				return json(RATE_LIMITED, 429);
			}

			const body = await readJsonBody(context.request);
			const parsed = CompletedChallengesRequestSchema.safeParse(body);
			if (!parsed.success) {
				return json(INVALID_PROGRESS, 400);
			}

			const submitted = parsed.data.challenges;
			const now = systemClock.nowEpochMilliseconds();
			if (
				submitted.some(
					(challenge) => !isPlausibleSyncTimeRange(challenge.createdAt, challenge.updatedAt, now),
				)
			) {
				return json(INVALID_PROGRESS, 400);
			}

			const { questionIdsByExam } = await getCatalog();
			if (submitted.some((challenge) => !isValidChallengeShape(challenge, questionIdsByExam))) {
				return json(INVALID_PROGRESS, 400);
			}

			try {
				const challenges = await syncChallenges(db, syncLink, submitted);
				return json({ challenges });
			} catch (error) {
				if (error instanceof SyncLinkNotFoundError) {
					return json(UNKNOWN_LINK, 404);
				}
				if (error instanceof ChallengeConflictError) {
					return json(CONFLICT, 409);
				}
				console.error("syncChallenges failed", error);
				return json(INTERNAL_ERROR, 500);
			}
		},

		async destroy(context) {
			const db = getDatabase();
			if (!db) {
				return json(INTERNAL_ERROR, 500);
			}

			const syncLink = await resolveSyncLink(context.request);
			if (!syncLink) {
				return json(UNKNOWN_LINK, 404);
			}
			if (!(await isAllowed(`sync:${syncLink}`))) {
				return json(RATE_LIMITED, 429);
			}

			try {
				await deleteSyncLink(db, syncLink);
				return json({ ok: true });
			} catch (error) {
				console.error("deleteSyncLink failed", error);
				return json(INTERNAL_ERROR, 500);
			}
		},
	},
});
