import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerHistory, makeAnswerRecord } from "../../types/test/answerRecord";
import { aggregateStats } from "./dashboardAggregator";

/**
 * Phase2a 集計層（日次/週次バケット・ヒートマップ・目標リング）のユニットテスト。
 * JST(UTC+9) 固定のバケット境界を Date.UTC で精密に作って検証する。
 * 既存の月次・同値テストは別ファイルで後方互換を担保する。
 */

// JST 2024-01-20 12:00（= UTC 03:00）。todayKey は "2024-01-20"。
const NOW = Date.UTC(2024, 0, 20, 3, 0, 0);
const DAY = 86_400_000;

function history(...records: AnswerRecord[]): Record<string, AnswerRecord[]> {
	return makeAnswerHistory(records);
}

describe("JST 日次バケット（dailyStats）", () => {
	it("UTC 日付境界をまたぐ epoch を JST の正しい日に割り当てる", () => {
		// 同じ UTC 日付(1/15)でも JST では 1/15 と 1/16 に分かれる
		const h = history(
			makeAnswerRecord({
				questionId: "q1",
				createdAt: Date.UTC(2024, 0, 15, 14, 59),
				isCorrect: true,
			}),
			makeAnswerRecord({
				questionId: "q2",
				createdAt: Date.UTC(2024, 0, 15, 15, 0),
				isCorrect: false,
			}),
		);

		const { dailyStats } = aggregateStats(h, NOW);
		const byKey = Object.fromEntries(dailyStats.map((d) => [d.key, d]));

		expect(byKey["2024-01-15"].totalAnswers).toBe(1);
		expect(byKey["2024-01-15"].label).toBe("1/15");
		expect(byKey["2024-01-16"].totalAnswers).toBe(1);
		expect(byKey["2024-01-16"].accuracy).toBe(0); // q2 は不正解
	});

	it("直近30日より古い日は dailyStats から除外する", () => {
		const h = history(
			makeAnswerRecord({ questionId: "q1", createdAt: NOW - 40 * DAY }), // 40日前 → 除外
			makeAnswerRecord({ questionId: "q2", createdAt: NOW - 5 * DAY }), // 5日前 → 含む
		);

		const { dailyStats } = aggregateStats(h, NOW);
		const keys = dailyStats.map((d) => d.key);

		expect(keys).toContain("2024-01-15"); // NOW(1/20) - 5日
		expect(keys).not.toContain("2023-12-11"); // 40日前
	});
});

describe("JST 週次バケット（weeklyStats・月曜起点）", () => {
	it("同一 JST 週（月曜起点）の回答を1バケットにまとめ、ラベルは月曜の M/D〜", () => {
		// 2024-01-15 は月曜。1/16(火)・1/20(土) は同じ週。
		const h = history(
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 16, 1, 0) }), // JST 1/16
			makeAnswerRecord({ questionId: "q2", createdAt: Date.UTC(2024, 0, 20, 1, 0) }), // JST 1/20
		);

		const { weeklyStats } = aggregateStats(h, NOW);

		expect(weeklyStats).toHaveLength(1);
		expect(weeklyStats[0].key).toBe("2024-01-15");
		expect(weeklyStats[0].label).toBe("1/15〜");
		expect(weeklyStats[0].totalAnswers).toBe(2);
	});
});

describe("学習ヒートマップ（heatmap）", () => {
	it("直近15週=105日を0埋めで返し、末尾は今日(JST)", () => {
		const { heatmap } = aggregateStats({}, NOW);

		expect(heatmap).toHaveLength(105);
		expect(heatmap[104].dateKey).toBe("2024-01-20"); // 末尾=今日
		expect(heatmap[104].label).toBe("1/20");
		expect(heatmap.every((cell) => cell.count === 0)).toBe(true); // 空履歴は全0
	});

	it("回答のある日のセルにその日の回答数が入る", () => {
		const h = history(
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 18, 1, 0) }), // JST 1/18
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 18, 2, 0) }), // JST 1/18（再解答）
		);

		const { heatmap } = aggregateStats(h, NOW);
		const cell = heatmap.find((c) => c.dateKey === "2024-01-18");

		expect(cell?.count).toBe(2); // その日の回答回数（ユニーク問題数ではない）
	});
});

describe("今日の演習リング分子（todayCount）", () => {
	it("今日(JST)解いたユニーク問題数を数え、再解答で水増ししない・他日は除外する", () => {
		const h = history(
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 20, 1, 0) }), // 今日
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 20, 2, 0) }), // 今日・同問題（再解答）
			makeAnswerRecord({ questionId: "q2", createdAt: Date.UTC(2024, 0, 20, 3, 0) }), // 今日・別問題
			makeAnswerRecord({ questionId: "q3", createdAt: Date.UTC(2024, 0, 19, 1, 0) }), // 昨日 → 除外
		);

		const { todayCount } = aggregateStats(h, NOW);

		expect(todayCount).toBe(2); // q1, q2（q1 は再解答でも1、q3 は昨日で除外）
	});

	it("今日と別日にまたがる問題は、今日の回答があれば1として数える", () => {
		// q1 は昨日(1/19)と今日(1/20)に1回ずつ → 今日の回答があるので 1。
		const h = history(
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 19, 1, 0) }), // 昨日
			makeAnswerRecord({ questionId: "q1", createdAt: Date.UTC(2024, 0, 20, 1, 0) }), // 今日
		);

		expect(aggregateStats(h, NOW).todayCount).toBe(1);
	});

	it("空履歴は todayCount 0", () => {
		expect(aggregateStats({}, NOW).todayCount).toBe(0);
	});
});
