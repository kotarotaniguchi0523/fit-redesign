import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../types/answer";
import {
	aggregateByMonth,
	aggregateStats,
	calculateTrend,
	mapQuestionToUnit,
} from "./dashboardAggregator";

/**
 * ダッシュボード集計の古典派ユニットテスト。
 * いずれも純粋 public 関数なので入力 → 出力を AAA で検証する。
 * 単元マッピングは静的なプロジェクトデータ（unitBasedTabs）を in-process 依存として使う。
 * 月境界の TZ 依存を避けるため、タイムスタンプは local の new Date(年, 月, 日) で生成し、
 * 集計側の getMonth() と往復で一致させる（テストフィクスチャでの new Date は許容）。
 */

// 月境界から十分離れた固定タイムスタンプ（local 構築 → 集計の getMonth() と往復一致）
const jan15 = new Date(2024, 0, 15).getTime();
const jan20 = new Date(2024, 0, 20).getTime();
const feb10 = new Date(2024, 1, 10).getTime();

function rec(
	partial: Partial<AnswerRecord> & { questionId: string; timestamp: number },
): AnswerRecord {
	// フィクスチャは時刻を `timestamp` 引数で受け取り createdAt に写す（AnswerRecord は createdAt のみ）。
	const { timestamp, ...rest } = partial;
	return {
		id: 1,
		userId: "u1",
		selectedLabel: "ア",
		isCorrect: true,
		duration: null,
		...rest,
		createdAt: rest.createdAt ?? timestamp,
	};
}

describe("mapQuestionToUnit", () => {
	it("既知 exam の questionId を単元 ID へ写像する", () => {
		expect(mapQuestionToUnit("exam1-2013-q1")).toBe("unit-base-conversion");
	});

	it("問題番号が違っても同じ exam なら同じ単元（examId 部分でマッチ）", () => {
		expect(mapQuestionToUnit("exam1-2013-q7")).toBe("unit-base-conversion");
	});

	it("qN サフィックスが無い不正な形式は null", () => {
		expect(mapQuestionToUnit("exam1-2013")).toBeNull();
	});

	it("未知の exam は null", () => {
		expect(mapQuestionToUnit("exam99-1999-q1")).toBeNull();
	});
});

describe("calculateTrend", () => {
	it("値が 1 個以下なら stable（傾き計算不能）", () => {
		expect(calculateTrend([])).toBe("stable");
		expect(calculateTrend([50])).toBe("stable");
	});

	it("十分大きい上昇傾向は improving", () => {
		expect(calculateTrend([0, 20, 40, 60, 80])).toBe("improving");
	});

	it("十分大きい下降傾向は declining", () => {
		expect(calculateTrend([80, 60, 40, 20, 0])).toBe("declining");
	});

	it("横ばいは stable（傾き ±3 以内）", () => {
		expect(calculateTrend([50, 50, 50, 50])).toBe("stable");
	});
});

describe("aggregateByMonth", () => {
	it("月ごとに正答率と平均時間を集計し、月昇順に並べる", () => {
		// Arrange: 2024-01 に2件(1正解)、2024-02 に1件(正解)
		const answers = [
			rec({ questionId: "q1", timestamp: feb10, isCorrect: true, duration: 30 }),
			rec({ questionId: "q2", timestamp: jan15, isCorrect: true, duration: 10 }),
			rec({ questionId: "q3", timestamp: jan20, isCorrect: false, duration: 20 }),
		];

		// Act
		const stats = aggregateByMonth(answers);

		// Assert: 月昇順、2024-01 が先頭
		expect(stats.map((s) => s.month)).toEqual(["2024-01", "2024-02"]);
		expect(stats[0]).toMatchObject({
			month: "2024-01",
			totalAnswers: 2,
			correctAnswers: 1,
			accuracy: 50,
			avgDuration: 15, // (10 + 20) / 2
		});
		expect(stats[1]).toMatchObject({
			month: "2024-02",
			totalAnswers: 1,
			correctAnswers: 1,
			accuracy: 100,
			avgDuration: 30,
		});
	});

	it("duration が null の回答は平均時間に含めない（全件 null なら avgDuration は null）", () => {
		// Arrange
		const answers = [
			rec({ questionId: "q1", timestamp: jan15, isCorrect: true, duration: null }),
			rec({ questionId: "q2", timestamp: jan20, isCorrect: false, duration: null }),
		];

		// Act
		const [stat] = aggregateByMonth(answers);

		// Assert
		expect(stat.avgDuration).toBeNull();
		expect(stat.accuracy).toBe(50);
	});

	it("空配列は空の月次統計", () => {
		expect(aggregateByMonth([])).toEqual([]);
	});
});

describe("aggregateStats", () => {
	it("回答ゼロなら集計は全てゼロ・trend は stable", () => {
		// Act
		const data = aggregateStats({});

		// Assert
		expect(data.totalAnswered).toBe(0);
		expect(data.totalAttempts).toBe(0);
		expect(data.overallAccuracy).toBe(0);
		expect(data.avgDuration).toBeNull();
		expect(data.monthlyStats).toEqual([]);
		expect(data.unitStats).toEqual([]);
		expect(data.trend).toBe("stable");
	});

	it("正答率は問題ごとの最新回答ベース、総回答回数は全試行を数える", () => {
		// Arrange: q1 は誤 → 正（最新は正）、q2 は1回誤
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: jan15, isCorrect: false, duration: 10 }),
				rec({ questionId: "exam1-2013-q1", timestamp: jan20, isCorrect: true, duration: 20 }),
			],
			"exam1-2013-q2": [
				rec({ questionId: "exam1-2013-q2", timestamp: jan20, isCorrect: false, duration: 30 }),
			],
		};

		// Act
		const data = aggregateStats(history);

		// Assert
		expect(data.totalAttempts).toBe(3); // 全試行
		expect(data.totalAnswered).toBe(2); // ユニーク問題数
		expect(data.overallAccuracy).toBe(50); // 最新ベース: q1 正・q2 誤 → 1/2
		expect(data.avgDuration).toBe(20); // (10 + 20 + 30) / 3
	});
});
