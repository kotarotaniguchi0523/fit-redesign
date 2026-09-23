// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { CompletedChallengePayload } from "../features/challenge/types";
import { QuestionIdSchema } from "../types/browser";
import { createTestD1, type TestD1 } from "../types/test/d1";
import { syncChallenges } from "./challengeRepository";
import { createSyncLink } from "./progressRepository";
import { SyncKey } from "./syncKey";
import { SyncLinkId, type SyncLinkId as SyncLinkIdType } from "./syncLinkId";

const databases: TestD1[] = [];
const q1 = QuestionIdSchema.parse("exam1-2013-q1");

async function testDb(): Promise<TestD1> {
	const database = await createTestD1();
	databases.push(database);
	return database;
}

async function syncLinkId(rawKey: string): Promise<SyncLinkIdType> {
	const key = SyncKey.parse(rawKey)._unsafeUnwrap();
	return (await SyncLinkId.fromSyncKey(key))._unsafeUnwrap();
}

function completedChallenge(
	challengeId = "550e8400-e29b-41d4-a716-446655440000",
	judgment: "correct" | "incorrect" = "correct",
): CompletedChallengePayload {
	return {
		challengeId,
		examId: "exam1-2013",
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_100,
		answers: [
			{
				questionId: q1,
				elapsedMs: 3000,
				judgment,
				createdAt: 1_700_000_000_050,
				updatedAt: 1_700_000_000_100,
			},
		],
	};
}

afterEach(async () => {
	await Promise.all(databases.splice(0).map((database) => database.dispose()));
});

describe("challengeRepository", () => {
	it("完了結果を保存し、同じchallengeIdの再送を冪等に処理する", async () => {
		const { db } = await testDb();
		const link = await syncLinkId("a".repeat(43));
		await createSyncLink(db, link, 1_700_000_000_000);
		const input = completedChallenge();

		expect((await syncChallenges(db, link, [input]))._unsafeUnwrap()).toHaveLength(1);
		expect((await syncChallenges(db, link, [input, input]))._unsafeUnwrap()).toHaveLength(1);
	});

	it("同じchallengeIdの異なるpayloadと別リンクへの横流しを拒否する", async () => {
		const { db } = await testDb();
		const firstLink = await syncLinkId("a".repeat(43));
		const secondLink = await syncLinkId("b".repeat(43));
		await createSyncLink(db, firstLink, 1_700_000_000_000);
		await createSyncLink(db, secondLink, 1_700_000_000_000);
		const input = completedChallenge();
		await syncChallenges(db, firstLink, [input]);

		expect(
			(
				await syncChallenges(db, firstLink, [completedChallenge(input.challengeId, "incorrect")])
			)._unsafeUnwrapErr(),
		).toMatchObject({
			kind: "ChallengeConflict",
		});
		expect((await syncChallenges(db, secondLink, [input]))._unsafeUnwrapErr()).toMatchObject({
			kind: "ChallengeConflict",
		});
	});

	it("同一リクエスト内で同じchallengeIdの異なるpayloadを拒否する", async () => {
		const { db } = await testDb();
		const link = await syncLinkId("a".repeat(43));
		await createSyncLink(db, link, 1_700_000_000_000);

		const result = await syncChallenges(db, link, [
			completedChallenge("550e8400-e29b-41d4-a716-446655440001", "correct"),
			completedChallenge("550e8400-e29b-41d4-a716-446655440001", "incorrect"),
		]);

		expect(result._unsafeUnwrapErr()).toMatchObject({
			kind: "ChallengeConflict",
			challengeId: "550e8400-e29b-41d4-a716-446655440001",
		});
	});
});
