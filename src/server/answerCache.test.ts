import { describe, expect, it } from "vitest";
import type { AnswerStatus } from "../types/answer";
import { answerStatusKey, getAnswerStatuses, updateAnswerStatus } from "./answerCache";

/**
 * 古典派（Detroit school）ユニットテスト。
 * out-of-process 依存（KV / D1）だけを fake 注入し、read-through キャッシュの
 * 観測可能な振る舞い（戻り値・D1 発火有無・KV への書込み内容）を AAA で検証する。
 */

interface FakeKVOptions {
	throwOnGet?: boolean;
	throwOnPut?: boolean;
}

interface FakeKV {
	kv: KVNamespace;
	store: Map<string, string>;
	putCount: () => number;
	deleteCount: () => number;
}

function makeFakeKV(initial: Record<string, string> = {}, options: FakeKVOptions = {}): FakeKV {
	const store = new Map<string, string>(Object.entries(initial));
	let putCount = 0;
	let deleteCount = 0;
	const kv = {
		get(key: string, type?: string) {
			if (options.throwOnGet) return Promise.reject(new Error("KV get failed"));
			const raw = store.get(key);
			if (raw == null) return Promise.resolve(null);
			return Promise.resolve(type === "json" ? JSON.parse(raw) : raw);
		},
		put(key: string, value: string) {
			if (options.throwOnPut) return Promise.reject(new Error("KV put failed"));
			putCount++;
			store.set(key, value);
			return Promise.resolve();
		},
		delete(key: string) {
			deleteCount++;
			store.delete(key);
			return Promise.resolve();
		},
	} as unknown as KVNamespace;
	return { kv, store, putCount: () => putCount, deleteCount: () => deleteCount };
}

interface FakeD1 {
	db: D1Database;
	prepareCount: () => number;
}

/** getLatestAnswers が実行する prepare().bind().all() を再現する最小 fake。 */
function makeFakeD1(
	rows: { question_id: string; selected_label: string; is_correct: number }[],
): FakeD1 {
	let prepareCount = 0;
	const db = {
		prepare(_sql: string) {
			prepareCount++;
			return {
				bind(..._args: unknown[]) {
					return {
						all() {
							return Promise.resolve({ results: rows });
						},
					};
				},
			};
		},
	} as unknown as D1Database;
	return { db, prepareCount: () => prepareCount };
}

const STATUS_A: AnswerStatus = { label: "ア", isCorrect: true };
const STATUS_I: AnswerStatus = { label: "イ", isCorrect: false };

describe("answerStatusKey", () => {
	it("ユーザーごとに answer:{userId} 形式のキーを返す", () => {
		expect(answerStatusKey("user-1")).toBe("answer:user-1");
	});
});

describe("getAnswerStatuses（read-through）", () => {
	it("KV ヒット時は D1 を読まず KV の値を返す", async () => {
		// Arrange
		const cached = { "exam1-2013-q1": STATUS_A };
		const { kv } = makeFakeKV({ "answer:u1": JSON.stringify(cached) });
		const { db, prepareCount } = makeFakeD1([]);

		// Act
		const result = await getAnswerStatuses(kv, db, "u1");

		// Assert
		expect(result).toEqual(cached);
		expect(prepareCount()).toBe(0);
	});

	it("KV ミス時は D1 フォールバックし、結果を KV へ書き戻す", async () => {
		// Arrange
		const fakeKV = makeFakeKV();
		const { db, prepareCount } = makeFakeD1([
			{ question_id: "exam1-2013-q1", selected_label: "ア", is_correct: 1 },
		]);

		// Act
		const result = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert
		expect(result).toEqual({ "exam1-2013-q1": STATUS_A });
		expect(prepareCount()).toBe(1);
		expect(JSON.parse(fakeKV.store.get("answer:u1") ?? "null")).toEqual({
			"exam1-2013-q1": STATUS_A,
		});
	});

	it("書き戻し後の再読込は KV ヒットとなり D1 は再発火しない", async () => {
		// Arrange
		const fakeKV = makeFakeKV();
		const { db, prepareCount } = makeFakeD1([
			{ question_id: "exam1-2013-q1", selected_label: "ア", is_correct: 1 },
		]);

		// Act
		await getAnswerStatuses(fakeKV.kv, db, "u1");
		const second = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert
		expect(second).toEqual({ "exam1-2013-q1": STATUS_A });
		expect(prepareCount()).toBe(1);
	});

	it("D1 が空でも空マップを返し KV へ書き戻す", async () => {
		// Arrange
		const fakeKV = makeFakeKV();
		const { db } = makeFakeD1([]);

		// Act
		const result = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert
		expect(result).toEqual({});
		expect(fakeKV.store.has("answer:u1")).toBe(true);
	});

	it("KV 読み出しが失敗しても D1 にフォールバックして返す", async () => {
		// Arrange
		const fakeKV = makeFakeKV({}, { throwOnGet: true });
		const { db, prepareCount } = makeFakeD1([
			{ question_id: "exam1-2013-q1", selected_label: "ア", is_correct: 1 },
		]);

		// Act
		const result = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert
		expect(result).toEqual({ "exam1-2013-q1": STATUS_A });
		expect(prepareCount()).toBe(1);
	});

	it("KV 書き戻しが失敗しても D1 の結果を返す（例外を投げない）", async () => {
		// Arrange
		const fakeKV = makeFakeKV({}, { throwOnPut: true });
		const { db } = makeFakeD1([
			{ question_id: "exam1-2013-q1", selected_label: "ア", is_correct: 1 },
		]);

		// Act
		const result = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert
		expect(result).toEqual({ "exam1-2013-q1": STATUS_A });
	});
});

describe("updateAnswerStatus（submit 時の write-invalidate）", () => {
	it("warm な KV を無効化する（次の status 読み出しで D1 から再構築させる）", async () => {
		// Arrange
		const fakeKV = makeFakeKV({
			"answer:u1": JSON.stringify({ "exam1-2013-q1": STATUS_A }),
		});

		// Act
		await updateAnswerStatus(fakeKV.kv, "u1");

		// Assert: キーが削除され、get→mutate→put の競合（lost-update）が起きない
		expect(fakeKV.store.has("answer:u1")).toBe(false);
		expect(fakeKV.deleteCount()).toBe(1);
	});

	it("KV が cold でも安全に no-op（throw しない）", async () => {
		// Arrange
		const fakeKV = makeFakeKV();

		// Act / Assert
		await expect(updateAnswerStatus(fakeKV.kv, "u1")).resolves.toBeUndefined();
		expect(fakeKV.store.has("answer:u1")).toBe(false);
	});
});

describe("submit → status の整合（モジュール結合の振る舞い）", () => {
	it("submit で無効化後、status は D1 から最新マップを再構築して返す", async () => {
		// Arrange: q1 がキャッシュ済み、D1 には submit 済みの q1+q2 が存在
		const fakeKV = makeFakeKV({
			"answer:u1": JSON.stringify({ "exam1-2013-q1": STATUS_A }),
		});
		const { db, prepareCount } = makeFakeD1([
			{ question_id: "exam1-2013-q1", selected_label: "ア", is_correct: 1 },
			{ question_id: "exam1-2013-q2", selected_label: "イ", is_correct: 0 },
		]);

		// Act: submit で無効化 → status を取得
		await updateAnswerStatus(fakeKV.kv, "u1");
		const statuses = await getAnswerStatuses(fakeKV.kv, db, "u1");

		// Assert: D1 の正準マップ（両方）が返り、D1 が読まれる（再構築）
		expect(statuses).toEqual({
			"exam1-2013-q1": STATUS_A,
			"exam1-2013-q2": STATUS_I,
		});
		expect(prepareCount()).toBe(1);
	});
});
