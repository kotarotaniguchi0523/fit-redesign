import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UserId, UserIdSchema } from "../types";
import { createTestDb, type TestDb } from "../types/test/d1";
import { users } from "./schema";
import { upsertUser } from "./userRepository";

/**
 * upsertUser の integration テスト（実 SQLite）。
 * answers の FK 先である users 行の存在保証（id + created_at のみ）と、
 * 同一 userId の再 upsert が衝突せず冪等であることを検証する。
 */

const USER_ID: UserId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");

let testDb: TestDb;

beforeEach(() => {
	testDb = createTestDb();
});

afterEach(() => {
	testDb.close();
});

describe("upsertUser", () => {
	it("新規 userId の行を id + created_at で作成する", async () => {
		await upsertUser(testDb.db, USER_ID);

		const rows = await testDb.db.select().from(users).where(eq(users.id, USER_ID));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(USER_ID);
		expect(typeof rows[0]?.createdAt).toBe("number");
	});

	it("同一 userId の再 upsert は衝突せず行を増やさない（冪等・既存 created_at 保持）", async () => {
		await upsertUser(testDb.db, USER_ID);
		const first = await testDb.db.select().from(users).where(eq(users.id, USER_ID));
		const createdAt = first[0]?.createdAt;

		await upsertUser(testDb.db, USER_ID);

		const rows = await testDb.db.select().from(users).where(eq(users.id, USER_ID));
		expect(rows).toHaveLength(1);
		// onConflictDoNothing のため初回の created_at が保持される。
		expect(rows[0]?.createdAt).toBe(createdAt);
	});
});
