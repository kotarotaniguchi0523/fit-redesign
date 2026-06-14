import { afterEach, describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerRecord } from "../../types/test/answerRecord";
import type { SrsCard } from "./leitner";
import { deriveSrsFromHistory, summarizeSrs } from "./replay";
import { loadSrsState, recordGrade } from "./srs";

/**
 * D1 履歴リプレイ（replay.ts）の古典派ユニットテスト。
 * deriveSrsFromHistory は純粋関数なので入力 → 出力を AAA で検証する。
 * 「localStorage 側と同一 SrsState」は、同じ正誤系列を recordGrade に流した jsdom の
 * localStorage 状態と突き合わせて pin する（リプレイ導出の正当性の核）。
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_MS = 10 * 60 * 1000;
const BASE = 1_700_000_000_000;
// 秒単位で離した相異なるタイムスタンプ（created_at は ms）
const at = (seconds: number): number => BASE + seconds * 1000;

function rec(
	partial: Partial<AnswerRecord> & { questionId: string; createdAt: number },
): AnswerRecord {
	return makeAnswerRecord(partial);
}

describe("deriveSrsFromHistory", () => {
	it("空履歴は空 state", () => {
		expect(deriveSrsFromHistory({})).toEqual({});
	});

	it("連続正解を時系列に畳み、最終 box/due/last を再現する（box2・due は最終時刻+2日）", () => {
		// Arrange: q1 を t=0 正解 → t=100 正解
		const history = {
			q1: [
				rec({ questionId: "q1", createdAt: at(0), isCorrect: true }),
				rec({ questionId: "q1", createdAt: at(100), isCorrect: true }),
			],
		};

		// Act
		const state = deriveSrsFromHistory(history);

		// Assert: box2、due は最終回答時刻 + 2日、last は最終回答時刻
		expect(state.q1).toEqual({ box: 2, due: at(100) + 2 * DAY_MS, last: at(100) });
	});

	it("末尾の不正解は box=1 リセット・due は最終時刻+10分", () => {
		const history = {
			q1: [
				rec({ questionId: "q1", createdAt: at(0), isCorrect: true }),
				rec({ questionId: "q1", createdAt: at(100), isCorrect: true }),
				rec({ questionId: "q1", createdAt: at(200), isCorrect: false }),
			],
		};

		const state = deriveSrsFromHistory(history);

		expect(state.q1).toEqual({ box: 1, due: at(200) + RELEARN_MS, last: at(200) });
	});

	it("複数問題は互いに独立してリプレイされる", () => {
		const history = {
			q1: [rec({ questionId: "q1", createdAt: at(0), isCorrect: true })],
			q2: [
				rec({ questionId: "q2", createdAt: at(10), isCorrect: false }),
				rec({ questionId: "q2", createdAt: at(20), isCorrect: true }),
			],
		};

		const state = deriveSrsFromHistory(history);

		expect(state.q1.box).toBe(1);
		expect(state.q2.box).toBe(2); // 不正解→box1 リセット、続く正解で box2
		expect(Object.keys(state).sort()).toEqual(["q1", "q2"]);
	});
});

describe("localStorage 側（recordGrade）との同一性", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("同じ正誤系列なら recordGrade を流した localStorage state と完全一致する", () => {
		// Arrange: q1/q2 を時系列に交互。history は問題ごと（created_at 昇順）にグルーピング済み。
		const flat: AnswerRecord[] = [
			rec({ questionId: "q1", createdAt: at(0), isCorrect: true }),
			rec({ questionId: "q2", createdAt: at(5), isCorrect: false }),
			rec({ questionId: "q1", createdAt: at(10), isCorrect: true }),
			rec({ questionId: "q2", createdAt: at(15), isCorrect: true }),
			rec({ questionId: "q1", createdAt: at(20), isCorrect: false }),
		];
		const history: Record<string, AnswerRecord[]> = {
			q1: flat.filter((r) => r.questionId === "q1"),
			q2: flat.filter((r) => r.questionId === "q2"),
		};

		// Act: localStorage 側は全件を時系列順に recordGrade
		for (const r of flat) {
			recordGrade(r.questionId, r.isCorrect, r.createdAt);
		}
		const fromStorage = loadSrsState();
		const fromReplay = deriveSrsFromHistory(history);

		// Assert: 両者の SrsState が完全一致
		expect(fromReplay).toEqual(fromStorage);
	});
});

describe("summarizeSrs", () => {
	const card = (box: number, due: number): SrsCard => ({ box, due, last: due });

	it("空 state は seen=0・overdue=0・全ステージ0", () => {
		expect(summarizeSrs({}, BASE)).toEqual({
			seenCount: 0,
			overdueCount: 0,
			stages: { learning: 0, takingHold: 0, mastered: 0 },
		});
	});

	it("due <= now のカードを復習滞留(overdue)として数える", () => {
		const state = {
			a: card(2, BASE - 1), // 期限切れ
			b: card(2, BASE), // ちょうど now（境界 due <= now）
			c: card(2, BASE + 1), // 未来
		};

		expect(summarizeSrs(state, BASE).overdueCount).toBe(2);
	});

	it("box を 学習中(1-2)/定着しかけ(3-4)/定着(5) に内訳する", () => {
		const state = {
			a: card(1, BASE),
			b: card(2, BASE),
			c: card(3, BASE),
			d: card(4, BASE),
			e: card(5, BASE),
		};

		expect(summarizeSrs(state, BASE).stages).toEqual({
			learning: 2,
			takingHold: 2,
			mastered: 1,
		});
		expect(summarizeSrs(state, BASE).seenCount).toBe(5);
	});
});
