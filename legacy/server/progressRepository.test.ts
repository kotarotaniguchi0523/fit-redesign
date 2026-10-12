// @vitest-environment node
import { err } from "neverthrow";
import { afterEach, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../types/test/d1";
import { ProgressEntry, type ProgressEntry as ProgressEntryType } from "./progressEntry";
import { createSyncLink, deleteSyncLink, syncProgress } from "./progressRepository";
import { SyncKey } from "./syncKey";
import { SyncLinkId, type SyncLinkId as SyncLinkIdType } from "./syncLinkId";

const databases: TestD1[] = [];

async function testDb(): Promise<TestD1> {
	const database = await createTestD1();
	databases.push(database);
	return database;
}

async function syncLinkId(value = "a".repeat(43)): Promise<SyncLinkIdType> {
	const syncKey = SyncKey.parse(value)._unsafeUnwrap();
	return (await SyncLinkId.fromSyncKey(syncKey))._unsafeUnwrap();
}

function entry(index: number): ProgressEntryType {
	return ProgressEntry.parse({
		questionId: `exam1-2013-q${index}`,
		unitId: "unit-base-conversion",
		createdAt: 1_700_000_000_000 + index,
		updatedAt: 1_700_000_000_000 + index,
	})._unsafeUnwrap();
}

afterEach(async () => {
	await Promise.all(databases.splice(0).map((database) => database.dispose()));
});

describe("progressRepository", () => {
	it("暗号乱数の生成失敗をResultで返す", () => {
		expect(
			SyncKey.generate(() =>
				err({ kind: "GenerateSyncKeyError", cause: new Error("random unavailable") }),
			)._unsafeUnwrapErr(),
		).toMatchObject({
			kind: "GenerateSyncKeyError",
		});
	});

	it("同期キーをSHA-256へ変換する", async () => {
		const key = SyncKey.parse("a".repeat(43))._unsafeUnwrap();
		await expect(SyncLinkId.fromSyncKey(key)).resolves.toSatisfy(
			(result) => result.isOk() && /^[a-f0-9]{64}$/.test(result.value),
		);
	});

	it("同期領域にはハッシュと作成時刻だけを保存する", async () => {
		const { db, binding } = await testDb();
		const id = await syncLinkId();
		expect((await createSyncLink(db, id, 1_700_000_000_000)).isOk()).toBe(true);
		const stored = await binding.prepare("SELECT id, created_at FROM sync_links").first();
		expect(stored?.id).toBe(id);
		expect(stored?.created_at).toBe(1_700_000_000_000);
	});

	it("201件をUPSERTし、サーバー側の統合結果を返す", async () => {
		const { db } = await testDb();
		const id = await syncLinkId();
		await createSyncLink(db, id, 1_700_000_000_000);
		const result = await syncProgress(
			db,
			id,
			Array.from({ length: 201 }, (_, index) => entry(index + 1)),
		);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toHaveLength(201);
	}, 15_000);

	it("同じ問題は最新の単元と更新時刻、最初の作成時刻を採用する", async () => {
		const { db } = await testDb();
		const id = await syncLinkId();
		await createSyncLink(db, id, 1_700_000_000_000);
		const older = entry(1);
		const newer = ProgressEntry.parse({
			...older,
			unitId: "unit-logic",
			createdAt: 2_000_000_000_000,
			updatedAt: 2_000_000_000_000,
		})._unsafeUnwrap();
		const result = await syncProgress(db, id, [newer, older]);
		expect(result._unsafeUnwrap()).toEqual([{ ...newer, createdAt: older.createdAt }]);
	});

	it("存在しない同期領域は判別可能なエラーを返す", async () => {
		const { db } = await testDb();
		const id = await syncLinkId();
		const result = await syncProgress(db, id, [entry(1)]);
		expect(result._unsafeUnwrapErr()).toEqual({ kind: "SyncLinkNotFound", syncLinkId: id });
	});

	it("記録と同期領域を削除し、再削除も冪等に完了する", async () => {
		const { db } = await testDb();
		const id = await syncLinkId();
		await createSyncLink(db, id, 1_700_000_000_000);
		await syncProgress(db, id, [entry(1)]);
		expect((await deleteSyncLink(db, id)).isOk()).toBe(true);
		expect((await deleteSyncLink(db, id)).isOk()).toBe(true);
	});
});
