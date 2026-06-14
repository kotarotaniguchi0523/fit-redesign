import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerRecord } from "../../types/test/answerRecord";
import { questionAccuracy, questionScore, speedTier } from "./masteryScore";

/**
 * 習熟度モデル（問題スコア）の古典派ユニットテスト。純関数なので入出力を AAA で検証する。
 * 速度 tier の境界・正確性の窓・NULL 正規化・アンカー・不正解のみ を網羅し、
 * 最後にローカル D1 実データ22件を確定式（tier 5段階・速度=tier/4）で再計算したゴールデンで pin する。
 */

// duration（秒）と正誤から AnswerRecord を作る。createdAt は共有フィクスチャが
// 呼び出し順で単調増加させるため、配列生成順がそのまま「時系列昇順」になる。
function rec(isCorrect: boolean, duration: number | null): AnswerRecord {
	return makeAnswerRecord({ questionId: "q1", isCorrect, duration });
}

describe("speedTier（10秒区切りの境界）", () => {
	// [duration秒, 期待tier]
	const cases: [number, number][] = [
		[60, 0],
		[59.9, 1],
		[50, 1],
		[49.9, 2],
		[40, 2],
		[39.9, 3],
		[30, 3],
		[29.9, 4],
		[0, 4],
		[120, 0],
	];
	it.each(cases)("duration=%p秒 → tier %p", (duration, expected) => {
		expect(speedTier(duration)).toBe(expected);
	});
});

describe("questionAccuracy（0.6×直近3回 + 0.4×累計）", () => {
	it("回答1件・正解 → 1.0", () => {
		expect(questionAccuracy([rec(true, 45)])).toBeCloseTo(1.0);
	});

	it("回答1件・不正解 → 0", () => {
		expect(questionAccuracy([rec(false, 45)])).toBeCloseTo(0);
	});

	it("回答2件（正解→不正解）→ 直近0.5・累計0.5 → 0.5", () => {
		expect(questionAccuracy([rec(true, 45), rec(false, 45)])).toBeCloseTo(0.5);
	});

	it("回答4件（直近3回=正正誤=2/3, 累計=3/4）→ 0.6×0.667 + 0.4×0.75 = 0.70", () => {
		const records = [rec(true, 45), rec(true, 45), rec(true, 45), rec(false, 45)];
		// 直近3回 = 末尾[正,正,誤]=2/3、累計=3/4
		expect(questionAccuracy(records)).toBeCloseTo(0.6 * (2 / 3) + 0.4 * 0.75);
	});
});

describe("questionScore（0.7×正確性 + 0.3×速度）", () => {
	it("アンカー: 全正解・60秒以上 → 0.70（速度tier0）", () => {
		expect(questionScore([rec(true, 60)])).toBeCloseTo(0.7);
	});

	it("アンカー: 全正解・30秒未満 → 1.00（速度tier4）", () => {
		expect(questionScore([rec(true, 29.9)])).toBeCloseTo(1.0);
	});

	it("不正解のみ → 0", () => {
		expect(questionScore([rec(false, 20)])).toBeCloseTo(0);
		expect(questionScore([rec(false, 20), rec(false, 20)])).toBeCloseTo(0);
	});

	it("duration NULL は速度項を外して正規化（= 正確性そのもの）", () => {
		// 正解だが duration NULL → 速度なし → スコア = 正確性 = 1.0（0.7 で割り戻し済み）
		expect(questionScore([rec(true, null)])).toBeCloseTo(1.0);
	});

	it("直近の正解の duration が NULL なら、過去に duration ありの正解があっても速度なし", () => {
		// 直近正解(null) が速度の参照先。過去の dur=30 は使わない → 速度項なし → 正確性のみ。
		// 全正解なので正確性=1.0、速度なしで score=1.0（0.7 で割り戻し済み）。
		expect(questionScore([rec(true, 30), rec(true, null)])).toBeCloseTo(1.0);
	});

	it("速度は『最良の正解』ではなく『直近の正解』を使う（過去に速くても直近が遅ければ低速）", () => {
		// 過去に25秒(tier4)の正解があっても、直近の正解が70秒(tier0)なら速度0。
		// 全正解 → 正確性1.0、速度tier0 → score=0.7。
		expect(questionScore([rec(true, 25), rec(true, 70)])).toBeCloseTo(0.7);
	});

	it("速度は『直近の正解した回答』の duration から決まる（不正解の duration は無視）", () => {
		// 直近正解 dur=45 → tier2 → 速度0.5。末尾不正解の dur=10 は速度に使わない。
		// records: 正解(45) → 不正解(10)。正確性=0.6×0.5 + 0.4×0.5 = 0.5、速度=tier2/4=0.5
		const records = [rec(true, 45), rec(false, 10)];
		expect(questionScore(records)).toBeCloseTo(0.7 * 0.5 + 0.3 * 0.5);
	});

	it("空配列 → 0", () => {
		expect(questionScore([])).toBeCloseTo(0);
	});
});

describe("ゴールデンフィクスチャ（ローカル D1 実データ: 22回答・20問を確定式で再計算）", () => {
	// [questionId, 回答列(正誤, duration秒) created_at昇順, 期待スコア]
	const golden: [string, [boolean, number][], number][] = [
		["exam1-2013-q1", [[true, 95]], 0.7], // tier0
		["exam1-2014-q1", [[true, 60]], 0.7], // tier0
		["exam1-2015-q1", [[true, 45]], 0.85], // tier2 → 0.7+0.15
		["exam1-2016-q1", [[true, 35]], 0.925], // tier3 → 0.7+0.225
		[
			"exam2-2013-q1",
			[
				[false, 110],
				[true, 47],
			],
			0.5,
		], // acc0.5, tier2 → 0.35+0.15
		["exam2-2014-q1", [[true, 55]], 0.775], // tier1 → 0.7+0.075
		["exam2-2015-q1", [[true, 40]], 0.85], // tier2
		["exam2-2016-q1", [[true, 30]], 0.925], // tier3
		["exam3-2015-q1", [[false, 90]], 0], // 不正解のみ
		["exam3-2016-q1", [[true, 52]], 0.775], // tier1
		["exam6-2013-q1", [[true, 70]], 0.7], // tier0
		["exam6-2014-q1", [[true, 48]], 0.85], // tier2
		[
			"exam6-2015-q1",
			[
				[false, 75],
				[true, 55],
			],
			0.425,
		], // acc0.5, tier1 → 0.35+0.075
		["exam6-2016-q1", [[true, 42]], 0.85], // tier2
		["exam7-2013-q1", [[false, 120]], 0], // 不正解のみ
		["exam7-2014-q1", [[true, 50]], 0.775], // tier1
		["exam7-2016-q1", [[true, 33]], 0.925], // tier3
		["exam8-2014-q1", [[true, 65]], 0.7], // tier0
		["exam8-2015-q1", [[true, 38]], 0.925], // tier3
		["exam9-2013-q1", [[true, 44]], 0.85], // tier2
	];

	it.each(golden)("%s → スコア %p", (_qid, attempts, expected) => {
		const records = attempts.map(([ok, dur]) => rec(ok, dur));
		expect(questionScore(records)).toBeCloseTo(expected);
	});
	// 注: 単元別の仕上がり率（Σ問題スコア ÷ 着手問題数）は Phase 2 集計層の責務。
	// その平均ロジックは dashboardAggregator のテストで pin し、ここでは問題スコア単体のみ pin する。
});
