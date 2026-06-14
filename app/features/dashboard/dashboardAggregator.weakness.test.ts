import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerHistory, makeAnswerRecord } from "../../types/test/answerRecord";
import { aggregateStats, mapQuestionToUnit } from "./dashboardAggregator";

/**
 * Phase2b 弱点診断（カバレッジ・単元仕上がり率・弱点単元Top3・苦手問題Top5・ひっかかり・早とちり）。
 * ランキングの足切り（苦手問題=2回以上解答 / 弱点単元=2問以上着手）をユーザー決定どおり検証する。
 * 単元マッピング: exam1→基数変換 / exam2→負数表現 / exam4→論理演算 / exam8-2013→未割当。
 */

const NOW = Date.UTC(2024, 0, 20, 3, 0, 0);

function rec(
	questionId: string,
	isCorrect: boolean,
	duration: number | null,
	selectedLabel = "ア",
): AnswerRecord {
	return makeAnswerRecord({ questionId, isCorrect, duration, selectedLabel });
}

function history(...records: AnswerRecord[]): Record<string, AnswerRecord[]> {
	return makeAnswerHistory(records);
}

describe("カバレッジ", () => {
	it("分母は常に180、着手はユニーク問題数（exam8-2013 の未割当問題も着手に数える）", () => {
		const h = history(rec("exam1-2013-q1", true, 30), rec("exam8-2013-q1", false, 50));

		const { coverage } = aggregateStats(h, NOW);

		expect(coverage.total).toBe(180); // exam8-2013 の5問を含む現挙動
		expect(coverage.attempted).toBe(2); // 未割当の exam8-2013 も着手に数える
		expect(mapQuestionToUnit("exam8-2013-q1")).toBeNull(); // どの単元にも属さない
	});
});

describe("単元仕上がり率（unitMastery）", () => {
	it("着手問題の問題スコア平均を整数%で、全単元分（未着手は0）返す", () => {
		// exam1-2013-q1 正解30秒 → tier3 → score 0.925 → 93%
		const h = history(rec("exam1-2013-q1", true, 30));

		const { unitMastery } = aggregateStats(h, NOW);
		const base = unitMastery.find((u) => u.unitId === "unit-base-conversion");

		expect(base?.masteryRate).toBe(93);
		expect(base?.attempted).toBe(1);
		expect(base?.totalQuestions).toBe(25); // exam1 × 5年 × 5問
		// 未着手単元も0で含まれる
		expect(unitMastery.every((u) => typeof u.masteryRate === "number")).toBe(true);
		expect(unitMastery.length).toBeGreaterThanOrEqual(9);
	});
});

describe("弱点単元 Top3（足切り: 2問以上着手）", () => {
	it("2問以上着手した単元のみ・仕上がり率の低い順に最大3件、1問着手の単元は除外", () => {
		const h = history(
			// 基数変換: 2問とも不正解 → 0%
			rec("exam1-2013-q1", false, 50),
			rec("exam1-2014-q1", false, 50),
			// 負数表現: 2問正解（50s,30s）→ 85%
			rec("exam2-2013-q1", true, 50),
			rec("exam2-2014-q1", true, 30),
			// 論理演算: 2問正解（30s,30s）→ 93%
			rec("exam4-2013-q1", true, 30),
			rec("exam4-2014-q1", true, 30),
			// 浮動小数点: 1問のみ着手 → 足切りで除外
			rec("exam3-2013-q1", false, 50),
		);

		const { weakUnits } = aggregateStats(h, NOW);
		const ids = weakUnits.map((u) => u.unitId);

		expect(ids).toEqual(["unit-base-conversion", "unit-negative", "unit-logic"]); // 低い順
		expect(ids).not.toContain("unit-float"); // 1問着手は除外
		expect(weakUnits[0].masteryRate).toBe(0);
	});
});

describe("苦手問題 Top5（足切り: 2回以上解答）", () => {
	it("2回以上解答した問題のみ・問題スコアの低い順、1回だけの0%問題は除外", () => {
		const h = history(
			// 2回解答・両方不正解 → score 0
			rec("exam1-2013-q1", false, 50),
			rec("exam1-2013-q1", false, 50),
			// 2回解答・誤→正（50s）→ score 43
			rec("exam2-2013-q1", false, 50),
			rec("exam2-2013-q1", true, 50),
			// 1回だけ不正解（score 0 だが足切りで除外）
			rec("exam4-2013-q1", false, 50),
		);

		const { weakQuestions } = aggregateStats(h, NOW);
		const ids = weakQuestions.map((w) => w.questionId);

		expect(ids).toContain("exam1-2013-q1");
		expect(ids).toContain("exam2-2013-q1");
		expect(ids).not.toContain("exam4-2013-q1"); // 1回だけ → 除外
		// 低い順
		expect(ids.indexOf("exam1-2013-q1")).toBeLessThan(ids.indexOf("exam2-2013-q1"));
		expect(weakQuestions[0].score).toBe(0);
		expect(weakQuestions[0].label).toBe("基数変換 2013 Q1"); // 単元名 + 年度 + Q番号
	});

	it("同点スコアは questionId 昇順で決定的に並ぶ（入力順に依存しない）", () => {
		// 3問とも score 0（2回不正解）。入力を逆順で渡しても questionId 昇順で安定。
		const h = history(
			rec("exam4-2013-q1", false, 50),
			rec("exam4-2013-q1", false, 50),
			rec("exam1-2013-q1", false, 50),
			rec("exam1-2013-q1", false, 50),
			rec("exam2-2013-q1", false, 50),
			rec("exam2-2013-q1", false, 50),
		);

		const ids = aggregateStats(h, NOW).weakQuestions.map((w) => w.questionId);

		expect(ids).toEqual(["exam1-2013-q1", "exam2-2013-q1", "exam4-2013-q1"]);
	});
});

describe("ひっかかり選択肢（trapLabel）", () => {
	it("同一の誤答ラベルを2回以上選んでいればそのラベル", () => {
		const h = history(rec("exam1-2013-q1", false, 50, "イ"), rec("exam1-2013-q1", false, 50, "イ"));

		const weak = aggregateStats(h, NOW).weakQuestions.find((w) => w.questionId === "exam1-2013-q1");

		expect(weak?.trapLabel).toBe("イ");
	});

	it("誤答ラベルがばらけて2回未満なら null", () => {
		const h = history(rec("exam1-2013-q1", false, 50, "イ"), rec("exam1-2013-q1", false, 50, "ウ"));

		const weak = aggregateStats(h, NOW).weakQuestions.find((w) => w.questionId === "exam1-2013-q1");

		expect(weak?.trapLabel).toBeNull();
	});
});

describe("早とちり（hasty）", () => {
	it("40秒未満×不正解が複数回（2回以上）なら hasty", () => {
		const h = history(rec("exam1-2013-q1", false, 30), rec("exam1-2013-q1", false, 35));

		const weak = aggregateStats(h, NOW).weakQuestions.find((w) => w.questionId === "exam1-2013-q1");

		expect(weak?.hasty).toBe(true);
	});

	it("40秒未満×不正解が1回だけ、または速い正解では hasty にならない", () => {
		const h = history(
			rec("exam2-2013-q1", false, 30), // 速い不正解1回
			rec("exam2-2013-q1", true, 20), // 速い正解（早とちりではない）
		);

		const weak = aggregateStats(h, NOW).weakQuestions.find((w) => w.questionId === "exam2-2013-q1");

		expect(weak?.hasty).toBe(false);
	});
});
