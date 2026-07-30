import { Hono } from "hono";
import { errAsync, ResultAsync } from "neverthrow";
import { getAllExams } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import {
	createSyncSpace,
	deleteSyncSpace,
	type ProgressRepositoryError,
	syncProgress,
} from "../server/progressRepository";
import { SyncKey } from "../server/syncKey";
import { type HashSyncKeyError, SyncSpaceId } from "../server/syncSpaceId";
import { type Env, postBodyLimit, validate } from "./_lib";
import { ProgressSync } from "./_schemas";

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

function resolveSpace(c: {
	req: { header(name: string): string | undefined };
}): ResultAsync<SyncSpaceId, HashSyncKeyError | Readonly<{ kind: "InvalidSyncKey" }>> {
	const syncKey = SyncKey.parse(c.req.header("X-Sync-Key"));
	return syncKey.isOk()
		? SyncSpaceId.fromSyncKey(syncKey.value)
		: errAsync<SyncSpaceId, Readonly<{ kind: "InvalidSyncKey" }>>({ kind: "InvalidSyncKey" });
}

function isUnknownSpace(error: ProgressRepositoryError): boolean {
	return error.kind === "SyncSpaceNotFound";
}

const progress = new Hono<Env>()
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

		const syncKey = SyncKey.generate();
		if (syncKey.isErr()) {
			return c.json(INTERNAL_ERROR, 500);
		}
		const created = await SyncSpaceId.fromSyncKey(syncKey.value).andThen((syncSpaceId) =>
			createSyncSpace(c.var.db, syncSpaceId).map(() => syncKey.value),
		);
		return created.match(
			(key) => c.json({ key }, 201),
			() => c.json(INTERNAL_ERROR, 500),
		);
	})
	.post("/sync", validate("json", ProgressSync.schema), async (c) => {
		const syncSpace = await resolveSpace(c);
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
		const catalogKeys = await getCatalogKeys();
		if (submitted.some((entry) => !catalogKeys.has(`${entry.questionId}|${entry.unitId}`))) {
			return c.json(INVALID_PROGRESS, 400);
		}
		const result = await syncProgress(c.var.db, syncSpace.value, submitted);
		return result.match(
			(entries) => c.json({ entries }),
			(error) => (isUnknownSpace(error) ? c.json(UNKNOWN_SPACE, 404) : c.json(INTERNAL_ERROR, 500)),
		);
	})
	.delete("/", async (c) => {
		const syncSpace = await resolveSpace(c);
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
