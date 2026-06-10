import { describe, expect, it } from "vitest";
import { groupRowsByQuestion } from "../../server/answerRepository";
import { QuestionIdSchema, UserIdSchema } from "../../types";
import type { AnswerRecord } from "../../types/answer";
import { aggregateStats } from "./dashboardAggregator";
import { makeRows, oldAggregateStats, oldGroupRowsByQuestion } from "./dashboardAggregator.golden";

/**
 * golden-equivalence: 最適化後（実 export）と最適化前（bench ファイルの old コピー）の
 * 出力が deep-equal で完全同値（順序含む）であることを担保する。
 *
 * 既存 dashboardAggregator.test.ts は unitStats/questionDetails/trend をほぼ触らず
 * fake question ID を使うため、ここで実在 exam ペア + 大量データ + 境界ケースを検証する。
 */
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

function rec(
	partial: Partial<AnswerRecord> & { questionId: string; timestamp: number },
): AnswerRecord {
	const questionId = QuestionIdSchema.parse(partial.questionId);
	// フィクスチャは時刻を `timestamp` 引数で受け取り createdAt に写す（AnswerRecord は createdAt のみ）。
	const { timestamp, ...rest } = partial;
	return {
		id: 1,
		userId: UserIdSchema.parse(TEST_USER_ID),
		selectedLabel: "ア",
		isCorrect: true,
		duration: null,
		...rest,
		createdAt: rest.createdAt ?? timestamp,
		questionId,
	};
}

describe("groupRowsByQuestion 同値性", () => {
	it("small/medium/large の合成行で旧 reduce と deep-equal", () => {
		for (const count of [50, 1000, 20_000]) {
			const rows = makeRows(count);
			expect(groupRowsByQuestion(rows)).toEqual(oldGroupRowsByQuestion(rows));
		}
	});

	it("結果は plain Record（null-prototype でない）", () => {
		const result = groupRowsByQuestion(makeRows(10));
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
	});

	it("空入力は空 Record", () => {
		expect(groupRowsByQuestion([])).toEqual(oldGroupRowsByQuestion([]));
		expect(groupRowsByQuestion([])).toEqual({});
	});
});

describe("aggregateStats 同値性", () => {
	it("small/medium/large の合成履歴で旧実装と deep-equal", () => {
		for (const count of [50, 1000, 20_000]) {
			const history = groupRowsByQuestion(makeRows(count));
			expect(aggregateStats(history)).toEqual(oldAggregateStats(history));
		}
	});

	it("回答ゼロ（空 history）", () => {
		expect(aggregateStats({})).toEqual(oldAggregateStats({}));
	});

	it("全 duration が 0 → avgDuration は null（truthiness 分岐を保存）", () => {
		// 平均が 0（falsy）になる境界。1-pass 化で誤って 0 を返さないことを確認。
		const t = new Date(2024, 0, 15).getTime();
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: t, duration: 0, isCorrect: true }),
				rec({ questionId: "exam1-2013-q1", timestamp: t + 1, duration: 0, isCorrect: false }),
			],
		};
		const result = aggregateStats(history);
		expect(result.avgDuration).toBeNull();
		expect(result).toEqual(oldAggregateStats(history));
		// 月次側は逆に 0 を emit する（旧実装の差を保存）
		expect(result.monthlyStats[0].avgDuration).toBe(0);
	});

	it("単元横断で interleaved な timestamp（getRecentAccuracies の global sort 検証）", () => {
		// 同一単元の複数問題が時系列で交互に並ぶ → trend 計算の sort が壊れると divergence。
		const base = new Date(2024, 0, 1).getTime();
		const day = 86_400_000;
		// exam1-2013 は unit-base-conversion。q1/q2 を時系列で交互配置。
		const history = {
			"exam1-2013-q1": Array.from({ length: 6 }, (_, i) =>
				rec({
					questionId: "exam1-2013-q1",
					timestamp: base + i * 2 * day,
					isCorrect: i % 2 === 0,
					duration: 10 + i,
				}),
			),
			"exam1-2013-q2": Array.from({ length: 6 }, (_, i) =>
				rec({
					questionId: "exam1-2013-q2",
					timestamp: base + (i * 2 + 1) * day,
					isCorrect: i % 3 === 0,
					duration: 20 + i,
				}),
			),
		};
		expect(aggregateStats(history)).toEqual(oldAggregateStats(history));
	});

	it("duration が null と数値の混在", () => {
		const t = new Date(2024, 2, 10).getTime();
		const history = groupRowsByQuestion([
			{
				id: 1,
				userId: TEST_USER_ID,
				jsonId: "exam2-2013-q1",
				selectedLabel: "ア",
				isCorrect: 1,
				duration: null,
				createdAt: t,
			},
			{
				id: 2,
				userId: TEST_USER_ID,
				jsonId: "exam2-2013-q1",
				selectedLabel: "イ",
				isCorrect: 0,
				duration: 50,
				createdAt: t + 1000,
			},
		]);
		expect(aggregateStats(history)).toEqual(oldAggregateStats(history));
	});
});
