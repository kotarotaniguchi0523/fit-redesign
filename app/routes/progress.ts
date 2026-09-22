import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { ResultAsync } from "neverthrow";
import { getAllExams } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import { CompletedChallengesRequestSchema } from "../features/challenge/challengeWire";
import type { CompletedChallengePayload } from "../features/challenge/types";
import { hasPlausibleProgressTime } from "../features/progress/progress";
import { systemClock } from "../lib/dateTime";
import { ChallengeRepositoryError, syncChallenges } from "../server/challengeRepository";
import {
	createSyncLink,
	deleteSyncLink,
	ProgressRepositoryError,
	syncProgress,
} from "../server/progressRepository";
import { SyncKey, secureRandomBytes } from "../server/syncKey";
import { type HashSyncKeyError, SyncLinkId } from "../server/syncLinkId";
import {
	ProgressSyncRequestSchema,
	SyncHeaderSchema,
	type SyncKey as SyncKeyType,
} from "../types/browser";
import { type Env, postBodyLimit, validate } from "./_lib";

const RATE_LIMITED = { error: "Too many requests" } as const;
const UNKNOWN_LINK = { error: "Sync link not found" } as const;
const INVALID_PROGRESS = { error: "Unknown question or unit" } as const;
const INTERNAL_ERROR = { error: "Internal server error" } as const;

type RateLimitError = Readonly<{ kind: "RateLimitError"; cause: unknown }>;
type HashRateLimitSubjectError = Readonly<{ kind: "HashRateLimitSubjectError"; cause: unknown }>;

let catalogKeysPromise: Promise<Set<string>> | undefined;
let examQuestionIdsPromise: Promise<ReadonlyMap<string, readonly string[]>> | undefined;

async function buildCatalogKeys(): Promise<Set<string>> {
	const exams = await getAllExams();
	const byNumber = new Map(exams.map((exam) => [exam.examNumber, exam]));
	return new Set(
		unitBasedTabs.flatMap((unit) =>
			unit.examMapping.flatMap((mapping) =>
				mapping.examNumbers.flatMap((examNumber) => {
					const exam = byNumber.get(examNumber)?.exams[mapping.year];
					return (exam?.questions ?? []).map((question) => `${question.id}|${unit.id}`);
				}),
			),
		),
	);
}

function getCatalogKeys(): Promise<Set<string>> {
	if (!catalogKeysPromise) {
		catalogKeysPromise = buildCatalogKeys();
	}
	return catalogKeysPromise;
}

async function buildExamQuestionIds(): Promise<ReadonlyMap<string, readonly string[]>> {
	const exams = await getAllExams();
	return new Map(
		exams.flatMap((examByYear) =>
			Object.values(examByYear.exams).flatMap((exam) =>
				exam ? [[exam.id, exam.questions.map((q) => q.id)] as const] : [],
			),
		),
	);
}

function getExamQuestionIds(): Promise<ReadonlyMap<string, readonly string[]>> {
	if (!examQuestionIdsPromise) {
		examQuestionIdsPromise = buildExamQuestionIds();
	}
	return examQuestionIdsPromise;
}

function hasPlausibleChallengeTime(payload: CompletedChallengePayload, now: number): boolean {
	const maximum = now + 5 * 60 * 1000;
	return [
		payload.createdAt,
		payload.updatedAt,
		...payload.answers.flatMap((answer) => [answer.createdAt, answer.updatedAt]),
	].every((timestamp) => timestamp <= maximum);
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

function allow(c: { env: Cloudflare.Env }, key: string): ResultAsync<boolean, RateLimitError> {
	return ResultAsync.fromPromise(
		c.env.PROGRESS_RATE_LIMITER.limit({ key }),
		(cause): RateLimitError => ({ kind: "RateLimitError", cause }),
	).map((result) => result.success);
}

function hashRateLimitSubject(value: string): ResultAsync<string, HashRateLimitSubjectError> {
	return ResultAsync.fromPromise(
		crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
		(cause): HashRateLimitSubjectError => ({ kind: "HashRateLimitSubjectError", cause }),
	).map((digest) =>
		Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
	);
}

function resolveLink(syncKey: SyncKeyType): ResultAsync<SyncLinkId, HashSyncKeyError> {
	return SyncLinkId.fromSyncKey(syncKey);
}

const validateSyncHeader = zValidator("header", SyncHeaderSchema, (result, c) =>
	result.success ? undefined : c.json(UNKNOWN_LINK, 404),
);

// biome-ignore lint/nursery/useExplicitReturnType: Honoのレスポンス型推論を維持する
const createLink = async (c: Context<Env>) => {
	const ipAddress = c.req.header("CF-Connecting-IP") ?? "unknown";
	const rateLimitId = await hashRateLimitSubject(ipAddress);
	if (rateLimitId.isErr()) {
		return c.json(INTERNAL_ERROR, 500);
	}
	const allowed = await allow(c, `issue:${rateLimitId.value}`);
	if (allowed.isErr()) {
		return c.json(INTERNAL_ERROR, 500);
	}
	if (!allowed.value) {
		return c.json(RATE_LIMITED, 429);
	}

	const syncKey = SyncKey.generate(secureRandomBytes);
	if (syncKey.isErr()) {
		return c.json(INTERNAL_ERROR, 500);
	}
	const createdAt = systemClock.nowEpochMilliseconds();
	const created = await SyncLinkId.fromSyncKey(syncKey.value).andThen((syncLinkId) =>
		createSyncLink(c.var.db, syncLinkId, createdAt).map(() => syncKey.value),
	);
	return created.match(
		(key) => c.json({ key }, 201),
		() => c.json(INTERNAL_ERROR, 500),
	);
};

const progress = new Hono<Env>()
	.use("/*", csrf())
	.use("/*", postBodyLimit)
	.post("/links", createLink)
	.post("/spaces", createLink)
	.post("/sync", validateSyncHeader, validate("json", ProgressSyncRequestSchema), async (c) => {
		const syncLink = await resolveLink(c.req.valid("header")["x-sync-key"]);
		if (syncLink.isErr()) {
			return c.json(UNKNOWN_LINK, 404);
		}
		const allowed = await allow(c, `sync:${syncLink.value}`);
		if (allowed.isErr()) {
			return c.json(INTERNAL_ERROR, 500);
		}
		if (!allowed.value) {
			return c.json(RATE_LIMITED, 429);
		}

		const submitted = c.req.valid("json").entries;
		const nowEpochMilliseconds = systemClock.nowEpochMilliseconds();
		if (!submitted.every((entry) => hasPlausibleProgressTime(entry, nowEpochMilliseconds))) {
			return c.json(INVALID_PROGRESS, 400);
		}
		const catalogKeys = await getCatalogKeys();
		if (submitted.some((entry) => !catalogKeys.has(`${entry.questionId}|${entry.unitId}`))) {
			return c.json(INVALID_PROGRESS, 400);
		}
		const result = await syncProgress(c.var.db, syncLink.value, submitted);
		return result.match(
			(entries) => c.json({ entries }),
			(error) =>
				ProgressRepositoryError.isUnknownLink(error)
					? c.json(UNKNOWN_LINK, 404)
					: c.json(INTERNAL_ERROR, 500),
		);
	})
	.post(
		"/challenges",
		validateSyncHeader,
		validate("json", CompletedChallengesRequestSchema),
		async (c) => {
			const syncLink = await resolveLink(c.req.valid("header")["x-sync-key"]);
			if (syncLink.isErr()) {
				return c.json(UNKNOWN_LINK, 404);
			}
			const allowed = await allow(c, `sync:${syncLink.value}`);
			if (allowed.isErr()) {
				return c.json(INTERNAL_ERROR, 500);
			}
			if (!allowed.value) {
				return c.json(RATE_LIMITED, 429);
			}

			const submitted = c.req.valid("json").challenges;
			const nowEpochMilliseconds = systemClock.nowEpochMilliseconds();
			if (
				submitted.some((challenge) => !hasPlausibleChallengeTime(challenge, nowEpochMilliseconds))
			) {
				return c.json(INVALID_PROGRESS, 400);
			}
			const examQuestionIds = await getExamQuestionIds();
			if (submitted.some((challenge) => !isValidChallengeShape(challenge, examQuestionIds))) {
				return c.json(INVALID_PROGRESS, 400);
			}
			const result = await syncChallenges(c.var.db, syncLink.value, submitted);
			return result.match(
				(challenges) => c.json({ challenges }),
				(error) => {
					if (ChallengeRepositoryError.isUnknownLink(error)) {
						return c.json(UNKNOWN_LINK, 404);
					}
					if (ChallengeRepositoryError.isConflict(error)) {
						return c.json({ error: "Challenge already exists with different data" }, 409);
					}
					return c.json(INTERNAL_ERROR, 500);
				},
			);
		},
	)
	.delete("/", validateSyncHeader, async (c) => {
		const syncLink = await resolveLink(c.req.valid("header")["x-sync-key"]);
		if (syncLink.isErr()) {
			return c.json(UNKNOWN_LINK, 404);
		}
		const allowed = await allow(c, `sync:${syncLink.value}`);
		if (allowed.isErr()) {
			return c.json(INTERNAL_ERROR, 500);
		}
		if (!allowed.value) {
			return c.json(RATE_LIMITED, 429);
		}

		const deleted = await deleteSyncLink(c.var.db, syncLink.value);
		return deleted.match(
			() => c.json({ ok: true }),
			() => c.json(INTERNAL_ERROR, 500),
		);
	});

export default progress;
export type ProgressApp = typeof progress;
