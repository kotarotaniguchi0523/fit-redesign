import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerHistory, makeAnswerRecord } from "../../types/test/answerRecord";
import { aggregateStats } from "./dashboardAggregator";

/**
 * Phase2c セット合計タイム（set_id GROUP BY）のユニットテスト。
 * 完走判定 = exam{N}-{year} の q1〜q5 が同一 set_id に揃う。
 * 5問構成にならない set_id（今日の道由来）と set_id NULL は集計対象外。
 */

const NOW = Date.UTC(2024, 0, 20, 3, 0, 0);
const BASE = Date.UTC(2024, 0, 10, 0, 0, 0);
const at = (offsetSeconds: number): number => BASE + offsetSeconds * 1000;

function rec(
	questionId: string,
	setId: string | null,
	duration: number,
	createdAt: number,
): AnswerRecord {
	return makeAnswerRecord({ questionId, setId, duration, createdAt, isCorrect: true });
}

// exam{N}-{year} の q1〜q5 を同一 set_id・指定 duration で作る完走セット。
function completeSet(
	examId: string,
	setId: string,
	durations: number[],
	startAt: number,
): AnswerRecord[] {
	return durations.map(
		(duration, index): AnswerRecord =>
			rec(`${examId}-q${index + 1}`, setId, duration, startAt + index * 1000),
	);
}

describe("aggregateSetTimes（完走セットの通しタイム）", () => {
	it("q1〜q5 が同一 set_id に揃うと合計タイムが確定する", () => {
		const h = makeAnswerHistory(completeSet("exam1-2013", "s1", [30, 40, 50, 60, 70], at(0)));

		const { setTimes } = aggregateStats(h, NOW);

		expect(setTimes).toHaveLength(1);
		expect(setTimes[0]).toMatchObject({
			unitId: "unit-base-conversion",
			year: "2013",
			examNumber: 1,
			totalSeconds: 250, // 30+40+50+60+70
		});
	});

	it("5問揃わない set_id は合計対象外（q1〜q4 のみ）", () => {
		const h = makeAnswerHistory([
			rec("exam1-2013-q1", "s2", 30, at(0)),
			rec("exam1-2013-q2", "s2", 40, at(1)),
			rec("exam1-2013-q3", "s2", 50, at(2)),
			rec("exam1-2013-q4", "s2", 60, at(3)),
		]);

		expect(aggregateStats(h, NOW).setTimes).toHaveLength(0);
	});

	it("複数 exam にまたがる set_id（今日の道由来）は合計対象外", () => {
		// 5問だが exam が全てバラバラ（exam 単位の小テストではない）
		const h = makeAnswerHistory([
			rec("exam1-2013-q1", "s3", 30, at(0)),
			rec("exam2-2013-q1", "s3", 40, at(1)),
			rec("exam3-2013-q1", "s3", 50, at(2)),
			rec("exam4-2013-q1", "s3", 60, at(3)),
			rec("exam6-2013-q1", "s3", 70, at(4)),
		]);

		expect(aggregateStats(h, NOW).setTimes).toHaveLength(0);
	});

	it("set_id が NULL の行は集計対象外", () => {
		const h = makeAnswerHistory([
			rec("exam1-2013-q1", null, 30, at(0)),
			rec("exam1-2013-q2", null, 40, at(1)),
			rec("exam1-2013-q3", null, 50, at(2)),
			rec("exam1-2013-q4", null, 60, at(3)),
			rec("exam1-2013-q5", null, 70, at(4)),
		]);

		expect(aggregateStats(h, NOW).setTimes).toHaveLength(0);
	});

	it("同一単元で複数の完走セットがあれば、最新（completedAt 最大）の1件だけ返す", () => {
		const h = makeAnswerHistory([
			// 古いセット exam1-2013（合計100）
			...completeSet("exam1-2013", "old", [20, 20, 20, 20, 20], at(0)),
			// 新しいセット exam1-2014（合計250）。どちらも unit-base-conversion。
			...completeSet("exam1-2014", "new", [30, 40, 50, 60, 70], at(100)),
		]);

		const { setTimes } = aggregateStats(h, NOW);

		expect(setTimes).toHaveLength(1); // 単元ごとに最新1件
		expect(setTimes[0]).toMatchObject({ year: "2014", examNumber: 1, totalSeconds: 250 });
	});
});
