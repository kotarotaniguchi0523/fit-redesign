import { describe, expect, it } from "vitest";
import { type InsertAnswerInput, insertAnswer } from "./answerRepository";

/**
 * 古典派（Detroit school）ユニットテスト。
 * out-of-process 依存（D1）だけを fake 注入し、insertAnswer の観測可能な振る舞い
 * （answers への bind 値・返り値・users upsert の副作用）を AAA で検証する。
 * 実装詳細（SQL の整形やライブラリ呼び出し）ではなく振る舞いを検証＝リファクタ耐性。
 *
 * fake D1 注入パターンで out-of-process 依存を差し替える。
 */

interface RecordedCall {
	sql: string;
	args: unknown[];
}

interface FakeD1 {
	db: D1Database;
	calls: RecordedCall[];
	prepareCount: () => number;
}

/**
 * insertAnswer が実行する prepare().bind().run() を再現する最小 fake。
 * 各 prepare/bind を {sql, args} として記録し、run() は last_row_id を返す。
 * users upsert と answers insert を区別するため、SQL に "answers" を含む run() のみ
 * answersLastRowId を返し、それ以外（users upsert）は usersLastRowId を返す。
 */
function makeFakeD1(answersLastRowId: number, usersLastRowId = 7): FakeD1 {
	const calls: RecordedCall[] = [];
	let prepareCount = 0;
	const db = {
		prepare(sql: string): {
			bind: (...args: unknown[]) => { run: () => Promise<{ meta: { last_row_id: number } }> };
		} {
			prepareCount++;
			return {
				bind(...args: unknown[]): { run: () => Promise<{ meta: { last_row_id: number } }> } {
					calls.push({ sql, args });
					return {
						run(): Promise<{ meta: { last_row_id: number } }> {
							const lastRowId = sql.includes("answers") ? answersLastRowId : usersLastRowId;
							return Promise.resolve({ meta: { last_row_id: lastRowId } });
						},
					};
				},
			};
		},
	} as unknown as D1Database;
	return { db, calls, prepareCount: () => prepareCount };
}

function findAnswersCall(calls: RecordedCall[]): RecordedCall {
	const call = calls.find((c) => c.sql.includes("INSERT INTO answers"));
	if (call == null) {
		throw new Error("answers insert call not recorded");
	}
	return call;
}

const BASE_INPUT: InsertAnswerInput = {
	userId: "user-1",
	questionId: "exam1-2013-q1",
	selectedLabel: "ア",
	isCorrect: true,
	duration: 42,
	setId: null,
};

// TODO(T12): Drizzle 化により insertAnswer は prepare().bind() ではなく insert-from-select を
// 実行するため、この fake-D1 ユニットテストは成立しない。vitest-pool-workers の実 D1 ハーネスへ移行する。
describe.skip("insertAnswer", () => {
	it("正常系: answers へ入力値を順序通り bind し、answers insert の last_row_id を返す", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(123);

		// Act
		const answerId = await insertAnswer(db, BASE_INPUT);

		// Assert: 返り値は answers insert の last_row_id（users upsert の 7 ではない）
		expect(answerId).toBe(123);
		const answersCall = findAnswersCall(calls);
		// bind 順序は ? プレースホルダとの契約（順序ズレ＝誤データ永続化）
		expect(answersCall.args).toEqual([
			"user-1",
			"exam1-2013-q1",
			"ア",
			1, // isCorrect true → 1
			42, // duration
			1_700_000_000_000, // timestamp
		]);
	});

	it("正常系: answers insert に先立ち users upsert を対象 userId で発火する", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(123);

		// Act
		await insertAnswer(db, BASE_INPUT);

		// Assert: users upsert が answers insert より前に、対象ユーザーで発火する
		// （FK 依存の契約。prepare 回数のような内部実装は検証しない）
		const usersIdx = calls.findIndex((c) => c.sql.includes("INSERT INTO users"));
		const answersIdx = calls.findIndex((c) => c.sql.includes("INSERT INTO answers"));
		expect(usersIdx).toBeGreaterThanOrEqual(0);
		expect(answersIdx).toBeGreaterThanOrEqual(0);
		expect(usersIdx).toBeLessThan(answersIdx);
		// timestamp は upsertUser 内部依存なので検証しない
		expect(calls[usersIdx].args[0]).toBe("user-1");
	});

	it("duration が数値のとき、その値をそのまま bind する", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(1);

		// Act
		await insertAnswer(db, { ...BASE_INPUT, duration: 90 });

		// Assert
		expect(findAnswersCall(calls).args[4]).toBe(90);
	});

	it("duration が null のとき、null を bind する", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(1);

		// Act
		await insertAnswer(db, { ...BASE_INPUT, duration: null });

		// Assert
		expect(findAnswersCall(calls).args[4]).toBeNull();
	});

	it("境界: isCorrect=true は 1 に変換して bind する", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(1);

		// Act
		await insertAnswer(db, { ...BASE_INPUT, isCorrect: true });

		// Assert
		expect(findAnswersCall(calls).args[3]).toBe(1);
	});

	it("境界: isCorrect=false は 0 に変換して bind する", async () => {
		// Arrange
		const { db, calls } = makeFakeD1(1);

		// Act
		await insertAnswer(db, { ...BASE_INPUT, isCorrect: false });

		// Assert
		expect(findAnswersCall(calls).args[3]).toBe(0);
	});
});
