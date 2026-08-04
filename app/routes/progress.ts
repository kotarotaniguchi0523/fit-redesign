import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { ResultAsync } from "neverthrow";
import { getAllExams } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import { hasPlausibleRevealTime } from "../features/progress/progress";
import { systemClock } from "../lib/dateTime";
import {
	createSyncSpace,
	deleteSyncSpace,
	ProgressRepositoryError,
	syncProgress,
} from "../server/progressRepository";
import { SyncKey, secureRandomBytes } from "../server/syncKey";
import { type HashSyncKeyError, SyncSpaceId } from "../server/syncSpaceId";
import { ProgressSyncRequestSchema, SyncHeaderSchema, type SyncKey as SyncKeyType } from "../types";
import { type Env, postBodyLimit, validate } from "./_lib";

const RATE_LIMITED = { error: "Too many requests" } as const;
const UNKNOWN_SPACE = { error: "Sync space not found" } as const;
const INVALID_PROGRESS = { error: "Unknown question or unit" } as const;
const INTERNAL_ERROR = { error: "Internal server error" } as const;

type RateLimitError = Readonly<{ kind: "RateLimitError"; cause: unknown }>;
type HashRateLimitSubjectError = Readonly<{ kind: "HashRateLimitSubjectError"; cause: unknown }>;

let catalogKeysPromise: Promise<Set<string>> | undefined;

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

function resolveSpace(syncKey: SyncKeyType): ResultAsync<SyncSpaceId, HashSyncKeyError> {
	return SyncSpaceId.fromSyncKey(syncKey);
}

const validateSyncHeader = zValidator("header", SyncHeaderSchema, (result, c) =>
	result.success ? undefined : c.json(UNKNOWN_SPACE, 404),
);

const progress = new Hono<Env>()
	.use("/*", csrf())
	.use("/*", postBodyLimit)
	.post("/spaces", async (c) => {
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
		const created = await SyncSpaceId.fromSyncKey(syncKey.value).andThen((syncSpaceId) =>
			createSyncSpace(c.var.db, syncSpaceId, createdAt).map(() => syncKey.value),
		);
		return created.match(
			(key) => c.json({ key }, 201),
			() => c.json(INTERNAL_ERROR, 500),
		);
	})
	.post("/sync", validateSyncHeader, validate("json", ProgressSyncRequestSchema), async (c) => {
		const syncSpace = await resolveSpace(c.req.valid("header")["x-sync-key"]);
		if (syncSpace.isErr()) {
			return c.json(UNKNOWN_SPACE, 404);
		}
		const allowed = await allow(c, `sync:${syncSpace.value}`);
		if (allowed.isErr()) {
			return c.json(INTERNAL_ERROR, 500);
		}
		if (!allowed.value) {
			return c.json(RATE_LIMITED, 429);
		}

		const submitted = c.req.valid("json").entries;
		const nowEpochMilliseconds = systemClock.nowEpochMilliseconds();
		if (!submitted.every((entry) => hasPlausibleRevealTime(entry, nowEpochMilliseconds))) {
			return c.json(INVALID_PROGRESS, 400);
		}
		const catalogKeys = await getCatalogKeys();
		if (submitted.some((entry) => !catalogKeys.has(`${entry.questionId}|${entry.unitId}`))) {
			return c.json(INVALID_PROGRESS, 400);
		}
		const result = await syncProgress(c.var.db, syncSpace.value, submitted);
		return result.match(
			(entries) => c.json({ entries }),
			(error) =>
				ProgressRepositoryError.isUnknownSpace(error)
					? c.json(UNKNOWN_SPACE, 404)
					: c.json(INTERNAL_ERROR, 500),
		);
	})
	.delete("/", validateSyncHeader, async (c) => {
		const syncSpace = await resolveSpace(c.req.valid("header")["x-sync-key"]);
		if (syncSpace.isErr()) {
			return c.json(UNKNOWN_SPACE, 404);
		}
		const allowed = await allow(c, `sync:${syncSpace.value}`);
		if (allowed.isErr()) {
			return c.json(INTERNAL_ERROR, 500);
		}
		if (!allowed.value) {
			return c.json(RATE_LIMITED, 429);
		}

		const deleted = await deleteSyncSpace(c.var.db, syncSpace.value);
		return deleted.match(
			() => c.json({ ok: true }),
			() => c.json(INTERNAL_ERROR, 500),
		);
	});

export default progress;
export type ProgressApp = typeof progress;
