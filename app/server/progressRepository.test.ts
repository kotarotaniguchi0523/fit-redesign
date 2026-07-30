// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../types/test/d1";
import { ProgressEntry, type ProgressEntry as ProgressEntryType } from "./progressEntry";
import { createSyncSpace, deleteSyncSpace, syncProgress } from "./progressRepository";
import { SyncKey } from "./syncKey";
import { SyncSpaceId, type SyncSpaceId as SyncSpaceIdType } from "./syncSpaceId";

const databases: TestD1[] = [];

async function testDb(): Promise<TestD1> {
	const database = await createTestD1();
	databases.push(database);
	return database;
}

async function syncSpaceId(value = "a".repeat(43)): Promise<SyncSpaceIdType> {
	const syncKey = SyncKey.parse(value)._unsafeUnwrap();
	return (await SyncSpaceId.fromSyncKey(syncKey))._unsafeUnwrap();
}

function entry(index: number): ProgressEntryType {
	return ProgressEntry.parse({
		questionId: `exam1-2013-q${index}`,
		unitId: "unit-base-conversion",
		revealedAt: 1_700_000_000_000 + index,
	})._unsafeUnwrap();
}

afterEach(async () => {
	await Promise.all(databases.splice(0).map((database) => database.dispose()));
});

describe("progressRepository", () => {
	it("同期キーをSHA-256へ変換する", async () => {
		const key = SyncKey.parse("a".repeat(43))._unsafeUnwrap();
		await expect(SyncSpaceId.fromSyncKey(key)).resolves.toSatisfy(
			(result) => result.isOk() && /^[a-f0-9]{64}$/.test(result.value),
		);
	});

	it("同期領域にはハッシュと作成時刻だけを保存する", async () => {
		const { db, binding } = await testDb();
		const id = await syncSpaceId();
		expect((await createSyncSpace(db, id)).isOk()).toBe(true);
		const stored = await binding.prepare("SELECT id, created_at FROM sync_spaces").first();
		expect(stored?.id).toBe(id);
		expect(stored?.created_at).toEqual(expect.any(Number));
	});

	it("201件をUPSERTし、サーバー側の統合結果を返す", async () => {
		const { db } = await testDb();
		const id = await syncSpaceId();
		await createSyncSpace(db, id);
		const result = await syncProgress(
			db,
			id,
			Array.from({ length: 201 }, (_, index) => entry(index + 1)),
		);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toHaveLength(201);
	}, 15_000);

	it("同じ問題は最新日時とその単元を採用する", async () => {
		const { db } = await testDb();
		const id = await syncSpaceId();
		await createSyncSpace(db, id);
		const older = entry(1);
		const newer = ProgressEntry.parse({
			...older,
			unitId: "unit-logic",
			revealedAt: 2_000_000_000_000,
		})._unsafeUnwrap();
		const result = await syncProgress(db, id, [newer, older]);
		expect(result._unsafeUnwrap()).toEqual([newer]);
	});

	it("存在しない同期領域は判別可能なエラーを返す", async () => {
		const { db } = await testDb();
		const id = await syncSpaceId();
		const result = await syncProgress(db, id, [entry(1)]);
		expect(result._unsafeUnwrapErr()).toEqual({ kind: "SyncSpaceNotFound", syncSpaceId: id });
	});

	it("記録と同期領域を削除し、再削除も冪等に完了する", async () => {
		const { db } = await testDb();
		const id = await syncSpaceId();
		await createSyncSpace(db, id);
		await syncProgress(db, id, [entry(1)]);
		expect((await deleteSyncSpace(db, id)).isOk()).toBe(true);
		expect((await deleteSyncSpace(db, id)).isOk()).toBe(true);
	});
});
