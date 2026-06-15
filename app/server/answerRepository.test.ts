import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type QuestionId, QuestionIdSchema, type UserId, UserIdSchema } from "../types";
import { createTestDb, type TestDb } from "../types/test/d1";
import {
	getLatestAnswers,
	getUserAnswerHistory,
	type InsertAnswerInput,
	insertAnswer,
} from "./answerRepository";
import { answers, users } from "./schema";

/**
 * 実 SQLite（better-sqlite3 + baseline マイグレーション）に対する integration テスト（AAA）。
 *
 * 旧 fake-D1 ユニットは Drizzle 化（leftJoin / 相関サブクエリ / returning）で成立しなくなったため、
 * D1 と同方言の実 DB で「観測可能な振る舞い」（保存値・返り値・users upsert の副作用・最新解決）を
 * 検証する。bind 順などの実装詳細は見ない＝リファクタ耐性。
 */

const USER_ID: UserId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const OTHER_USER: UserId = UserIdSchema.parse("11111111-2222-3333-4444-555555555555");
const QID: QuestionId = QuestionIdSchema.parse("exam1-2013-q1");

const BASE_INPUT: InsertAnswerInput = {
	userId: USER_ID,
	questionId: QID,
	selectedLabel: "ア",
	isCorrect: true,
	duration: 42,
	setId: null,
};

let testDb: TestDb;

beforeEach(() => {
	testDb = createTestDb();
});

afterEach(() => {
	testDb.close();
});

describe("insertAnswer", () => {
	it("正常系: 入力値を answers へ保存し、生成された answerId を返す", async () => {
		const answerId = await insertAnswer(testDb.db, { ...BASE_INPUT, setId: "set-1" });

		expect(typeof answerId).toBe("number");
		const rows = await testDb.db.select().from(answers);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: answerId,
			userId: USER_ID,
			selectedLabel: "ア",
			isCorrect: 1, // true → 1
			duration: 42,
			setId: "set-1",
		});
		expect(typeof rows[0]?.createdAt).toBe("number");
		// json_id(exam1-2013-q1) が questions.id(FK) に解決されて保存される。
		const q = await testDb.db.select().from(answers).where(eq(answers.id, answerId));
		expect(q[0]?.questionId).toBeGreaterThan(0);
	});

	it("門番: 未登録の json_id は記録せず null を返す", async () => {
		const unknownQid = QuestionIdSchema.parse("exam9-2017-q9");
		const answerId = await insertAnswer(testDb.db, { ...BASE_INPUT, questionId: unknownQid });

		expect(answerId).toBeNull();
		expect(await testDb.db.select().from(answers)).toHaveLength(0);
	});

	it("FK 副作用: answers 保存に先立ち対象 userId の users 行を upsert する", async () => {
		await insertAnswer(testDb.db, BASE_INPUT);

		const userRows = await testDb.db.select().from(users).where(eq(users.id, USER_ID));
		expect(userRows).toHaveLength(1);
		expect(typeof userRows[0]?.createdAt).toBe("number");
	});

	it("境界: isCorrect=false は 0 として保存する", async () => {
		const answerId = await insertAnswer(testDb.db, { ...BASE_INPUT, isCorrect: false });

		const rows = await testDb.db
			.select()
			.from(answers)
			.where(eq(answers.id, answerId ?? -1));
		expect(rows[0]?.isCorrect).toBe(0);
	});

	it("境界: duration=null はそのまま null で保存する", async () => {
		const answerId = await insertAnswer(testDb.db, { ...BASE_INPUT, duration: null });

		const rows = await testDb.db
			.select()
			.from(answers)
			.where(eq(answers.id, answerId ?? -1));
		expect(rows[0]?.duration).toBeNull();
	});
});

describe("getLatestAnswers", () => {
	it("question ごとの最新回答（MAX id）を json_id キーで返す", async () => {
		// 同一 question に 2 回回答 → 後勝ち。別 question も 1 件。
		await insertAnswer(testDb.db, { ...BASE_INPUT, selectedLabel: "ア", isCorrect: false });
		await insertAnswer(testDb.db, { ...BASE_INPUT, selectedLabel: "ウ", isCorrect: true });
		const q2 = QuestionIdSchema.parse("exam1-2013-q2");
		await insertAnswer(testDb.db, { ...BASE_INPUT, questionId: q2, selectedLabel: "イ" });

		const statuses = await getLatestAnswers(testDb.db, USER_ID);

		expect(statuses["exam1-2013-q1"]).toEqual({ label: "ウ", isCorrect: true });
		expect(statuses["exam1-2013-q2"]).toEqual({ label: "イ", isCorrect: true });
	});

	it("他ユーザーの回答は混ざらない", async () => {
		await insertAnswer(testDb.db, BASE_INPUT);

		const statuses = await getLatestAnswers(testDb.db, OTHER_USER);

		expect(statuses).toEqual({});
	});
});

describe("getUserAnswerHistory", () => {
	it("question ごとに created_at 昇順でグルーピングして返す", async () => {
		await insertAnswer(testDb.db, { ...BASE_INPUT, selectedLabel: "ア" });
		await insertAnswer(testDb.db, { ...BASE_INPUT, selectedLabel: "イ" });

		const history = await getUserAnswerHistory(testDb.db, USER_ID);

		expect(Object.keys(history)).toEqual(["exam1-2013-q1"]);
		expect(history["exam1-2013-q1"]?.map((record) => record.selectedLabel)).toEqual(["ア", "イ"]);
		expect(history["exam1-2013-q1"]?.[0]).toMatchObject({ userId: USER_ID, questionId: QID });
	});
});
