// @vitest-environment node
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import progress from "../../routes/progress";
import { syncChallenges as syncStoredChallenges } from "../../server/challengeRepository";
import { createSyncLink } from "../../server/progressRepository";
import { SyncKey } from "../../server/syncKey";
import { SyncLinkId } from "../../server/syncLinkId";
import { QuestionIdSchema } from "../../types/browser";
import { createTestD1, type TestD1 } from "../../types/test/d1";
import { challengeSyncErrorMessage, syncChallenges } from "./challengeApi";
import type { CompletedChallengePayload } from "./types";

const syncKey = SyncKey.parse("a".repeat(43))._unsafeUnwrap();
const question1 = QuestionIdSchema.parse("exam1-2013-q1");
const question2 = QuestionIdSchema.parse("exam1-2013-q2");
const baseTime = 1_700_000_000_000;

class AllowAllRateLimit implements RateLimit {
	limit(_options: RateLimitOptions): Promise<RateLimitOutcome> {
		return Promise.resolve({ success: true });
	}
}

let database: TestD1 | undefined;

function testDatabase(): TestD1 {
	if (!database) {
		throw new Error("Test D1 has not been initialized");
	}
	return database;
}

function env(): Cloudflare.Env {
	return {
		DB: testDatabase().binding,
		PROGRESS_RATE_LIMITER: new AllowAllRateLimit(),
	};
}

function createApp(): Hono<{ Bindings: Cloudflare.Env }> {
	return new Hono<{ Bindings: Cloudflare.Env }>().route("/progress", progress);
}

function connectFetch(app: Hono<{ Bindings: Cloudflare.Env }>): void {
	vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
		const request =
			input instanceof Request
				? new Request(input, init)
				: new Request(new URL(input.toString(), "http://localhost"), init);
		return app.fetch(request, env());
	});
}

async function createSyncLinkForTest(): Promise<void> {
	const id = (await SyncLinkId.fromSyncKey(syncKey))._unsafeUnwrap();
	(await createSyncLink(testDatabase().db, id, baseTime))._unsafeUnwrap();
}

function challenge(
	challengeId: string,
	questionId: typeof question1 | typeof question2,
	judgment: "correct" | "incorrect" = "correct",
): CompletedChallengePayload {
	return {
		challengeId,
		examId: "exam1-2013",
		createdAt: baseTime,
		updatedAt: baseTime + 100,
		answers: [
			{
				questionId,
				elapsedMs: 3000,
				judgment,
				createdAt: baseTime + 50,
				updatedAt: baseTime + 100,
			},
		],
	};
}

beforeEach(async () => {
	database = await createTestD1();
});

afterEach(async () => {
	const currentDatabase = database;
	database = undefined;
	vi.restoreAllMocks();
	await currentDatabase?.dispose();
});

describe("challenge sync client and route integration", () => {
	// @lat: [[testing#Challenge client and player#Client sync returns local and server results together]]
	it("merges local results with existing server results through the HTTP client", async () => {
		const id = (await SyncLinkId.fromSyncKey(syncKey))._unsafeUnwrap();
		await createSyncLinkForTest();
		const remote = challenge("550e8400-e29b-41d4-a716-446655440001", question1);
		(await syncStoredChallenges(testDatabase().db, id, [remote]))._unsafeUnwrap();
		connectFetch(createApp());

		const local = challenge("550e8400-e29b-41d4-a716-446655440002", question2);
		const result = await syncChallenges(syncKey, [local]);

		expect(
			result
				._unsafeUnwrap()
				.map((item) => item.challengeId)
				.sort(),
		).toEqual([local.challengeId, remote.challengeId].sort());
	});

	it("maps a missing server sync link to the user-facing invalid-link error", async () => {
		connectFetch(createApp());

		const result = await syncChallenges(syncKey, []);

		expect(result._unsafeUnwrapErr()).toEqual({ kind: "InvalidSyncLink" });
		expect(challengeSyncErrorMessage(result._unsafeUnwrapErr())).toBe("同期リンクが無効です");
	});

	it("maps a conflicting challenge payload to the conflict error", async () => {
		const id = (await SyncLinkId.fromSyncKey(syncKey))._unsafeUnwrap();
		await createSyncLinkForTest();
		const original = challenge("550e8400-e29b-41d4-a716-446655440003", question1);
		(await syncStoredChallenges(testDatabase().db, id, [original]))._unsafeUnwrap();
		connectFetch(createApp());

		const conflicting = challenge(original.challengeId, question1, "incorrect");
		const result = await syncChallenges(syncKey, [conflicting]);

		expect(result._unsafeUnwrapErr()).toEqual({ kind: "Conflict" });
		expect(challengeSyncErrorMessage(result._unsafeUnwrapErr())).toContain("別の結果");
	});

	it("rejects malformed successful responses instead of accepting invalid challenge data", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ challenges: [{}] }));

		const result = await syncChallenges(syncKey, []);

		expect(result._unsafeUnwrapErr()).toEqual({ kind: "InvalidResponse" });
	});
});
