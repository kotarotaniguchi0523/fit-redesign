import { describe, expect, it } from "vitest";
import { syncAttempts } from "./timerRepository";

/**
 * 古典派（Detroit school）ユニットテスト。
 * out-of-process 依存（D1）だけを fake 注入し、syncAttempts の観測可能な振る舞い
 * （重複試行の冪等性・bind 値・users upsert の副作用・マージ返却）を AAA で検証する。
 *
 * fake D1 は (user_id, question_id, timestamp) の一意制約を持つ in-memory テーブルとして
 * 振る舞い、INSERT OR IGNORE のセマンティクス（既存キーは無視）を再現する。これにより
 * 「同一試行を二重 sync しても 1 行」という TOCTOU 修正後の契約を、SQL 文字列ではなく
 * 結果として永続化される行で検証できる（リファクタ耐性）。
 */

interface StoredRow {
	user_id: string;
	question_id: string;
	timestamp: number;
	duration: number;
	mode: string;
	target_time: number | null;
	completed: number;
	synced_at: number;
}

interface FakeD1 {
	db: D1Database;
	/** 永続化された attempts 行（一意制約適用後）。 */
	rows: StoredRow[];
	/** INSERT OR IGNORE で発行された {sql,args}（bind 検証用）。 */
	insertCalls: { sql: string; args: unknown[] }[];
	/** users upsert の bind 引数列（副作用・順序検証用）。 */
	userUpserts: unknown[][];
	/** 書き込み発火の通し番号（users upsert が insert より前かの順序検証用）。 */
	writeOrder: string[];
}

function makeFakeD1(seed: StoredRow[] = []): FakeD1 {
	const rows = [...seed];
	const insertCalls: { sql: string; args: unknown[] }[] = [];
	const userUpserts: unknown[][] = [];
	const writeOrder: string[] = [];

	function applyWrite(sql: string, args: unknown[]): void {
		if (sql.includes("INSERT INTO users")) {
			userUpserts.push(args);
			writeOrder.push("users");
			return;
		}
		if (sql.includes("INSERT OR IGNORE INTO attempts")) {
			insertCalls.push({ sql, args });
			writeOrder.push("attempt");
			const [userId, questionId, timestamp, duration, mode, targetTime, completed, syncedAt] =
				args as [string, string, number, number, string, number | null, number, number];
			// 一意制約: 同一 (user_id, question_id, timestamp) は無視（INSERT OR IGNORE）。
			const exists = rows.some(
				(r) => r.user_id === userId && r.question_id === questionId && r.timestamp === timestamp,
			);
			if (!exists) {
				rows.push({
					user_id: userId,
					question_id: questionId,
					timestamp,
					duration,
					mode,
					target_time: targetTime,
					completed,
					synced_at: syncedAt,
				});
			}
		}
	}

	function makeStatement(sql: string, args: unknown[]) {
		return {
			run() {
				applyWrite(sql, args);
				return Promise.resolve({ meta: {} });
			},
			all<T>() {
				// loadUserAttempts の SELECT: user_id で絞り timestamp 昇順。
				const userId = args[0] as string;
				const results = rows
					.filter((r) => r.user_id === userId)
					.sort((a, b) => a.timestamp - b.timestamp) as unknown as T[];
				return Promise.resolve({ results });
			},
		};
	}

	const db = {
		prepare(sql: string) {
			return { bind: (...args: unknown[]) => makeStatement(sql, args) };
		},
		batch(statements: { run: () => Promise<unknown> }[]) {
			return Promise.all(statements.map((s) => s.run()));
		},
	} as unknown as D1Database;

	return { db, rows, insertCalls, userUpserts, writeOrder };
}

const RECORD = {
	questionId: "exam1-2013-q1",
	attempts: [
		{ timestamp: 1_700_000_000_000, duration: 42, mode: "exam", completed: true, targetTime: 90 },
	],
};

describe("syncAttempts", () => {
	it("正常系: 新規試行を永続化し、マージ後の全データを返す", async () => {
		// Arrange
		const { db, rows } = makeFakeD1();

		// Act
		const merged = await syncAttempts(db, "user-1", { [RECORD.questionId]: RECORD });

		// Assert: 1 行永続化され、返り値の records に反映される
		expect(rows).toHaveLength(1);
		expect(merged.records[RECORD.questionId]?.attempts).toEqual([
			{ timestamp: 1_700_000_000_000, duration: 42, mode: "exam", completed: true, targetTime: 90 },
		]);
	});

	it("TOCTOU 修正: 同一試行を二重 sync しても重複行にならない（INSERT OR IGNORE 冪等）", async () => {
		// Arrange
		const { db, rows } = makeFakeD1();
		const payload = { [RECORD.questionId]: RECORD };

		// Act: 同じ payload を 2 回（同時 sync を模擬）
		await Promise.all([syncAttempts(db, "user-1", payload), syncAttempts(db, "user-1", payload)]);

		// Assert: 一意制約により 1 行のみ（旧 WHERE NOT EXISTS はここで 2 行になりえた）
		expect(rows).toHaveLength(1);
	});

	it("INSERT OR IGNORE に 8 引数を契約順で bind する", async () => {
		// Arrange
		const { db, insertCalls } = makeFakeD1();

		// Act
		await syncAttempts(db, "user-1", { [RECORD.questionId]: RECORD });

		// Assert: bind 順（? プレースホルダとの契約。順序ズレ＝誤データ永続化）
		const call = insertCalls.find((c) => c.sql.includes("INSERT OR IGNORE INTO attempts"));
		expect(call).toBeDefined();
		expect(call?.args).toHaveLength(8);
		// [user_id, question_id, timestamp, duration, mode, target_time, completed, synced_at]
		expect(call?.args.slice(0, 7)).toEqual([
			"user-1",
			"exam1-2013-q1",
			1_700_000_000_000,
			42,
			"exam",
			90,
			1, // completed true → 1
		]);
	});

	it("attempts insert に先立ち users upsert を対象 userId で発火する", async () => {
		// Arrange
		const { db, userUpserts, writeOrder } = makeFakeD1();

		// Act
		await syncAttempts(db, "user-1", { [RECORD.questionId]: RECORD });

		// Assert: FK 依存の契約 — users が attempt より前に、対象ユーザーで発火
		expect(writeOrder.indexOf("users")).toBeGreaterThanOrEqual(0);
		expect(writeOrder.indexOf("users")).toBeLessThan(writeOrder.indexOf("attempt"));
		expect(userUpserts[0]?.[0]).toBe("user-1");
	});

	it("targetTime 未設定の試行は target_time に null を bind する", async () => {
		// Arrange
		const { db, insertCalls } = makeFakeD1();
		const noTarget = {
			questionId: "exam1-2013-q2",
			attempts: [
				{ timestamp: 1_700_000_000_001, duration: 30, mode: "practice", completed: false },
			],
		};

		// Act
		await syncAttempts(db, "user-1", { [noTarget.questionId]: noTarget });

		// Assert: target_time（index 5）が null
		const call = insertCalls.find((c) => c.sql.includes("INSERT OR IGNORE INTO attempts"));
		expect(call?.args[5]).toBeNull();
		expect(call?.args[6]).toBe(0); // completed false → 0
	});

	it("既存行と同一キーの再 sync は無視し、新規キーのみ追加する", async () => {
		// Arrange: 既に 1 件永続化済み
		const { db, rows } = makeFakeD1([
			{
				user_id: "user-1",
				question_id: "exam1-2013-q1",
				timestamp: 1_700_000_000_000,
				duration: 42,
				mode: "exam",
				target_time: 90,
				completed: 1,
				synced_at: 1,
			},
		]);
		const payload = {
			"exam1-2013-q1": RECORD, // 既存キー（無視される）
			"exam1-2013-q2": {
				questionId: "exam1-2013-q2",
				attempts: [{ timestamp: 1_700_000_000_005, duration: 10, mode: "exam", completed: true }],
			},
		};

		// Act
		await syncAttempts(db, "user-1", payload);

		// Assert: 既存 1 + 新規 1 = 2 行（既存キーは重複追加されない）
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.question_id).sort()).toEqual(["exam1-2013-q1", "exam1-2013-q2"]);
	});
});
