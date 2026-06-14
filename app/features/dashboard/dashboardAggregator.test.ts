import { describe, expect, it } from "vitest";
import { unitBasedTabs } from "../../data/units";
import type { AnswerRecord } from "../../types/answer";
import { makeAnswerRecord } from "../../types/test/answerRecord";
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
 * 月次集計は JST(UTC+9) 基準で行うため、月境界テストは Date.UTC で epoch を直接指定する。
 * 月中の既存テストは UTC 月中＝JST 月中でもあるため、local 構築のままで問題ない。
 */

// 月境界から十分離れた固定タイムスタンプ（UTC 月中 = JST 月中 のため月は変わらない）
const jan15 = new Date(2024, 0, 15).getTime();
const jan20 = new Date(2024, 0, 20).getTime();
const feb10 = new Date(2024, 1, 10).getTime();

function rec(
	partial: Partial<AnswerRecord> & { questionId: string; timestamp: number },
): AnswerRecord {
	// 共有フィクスチャに既定を委譲。時刻は `timestamp` 引数で受け取り createdAt に写す糖衣。
	const { timestamp, ...rest } = partial;
	return makeAnswerRecord({ ...rest, createdAt: rest.createdAt ?? timestamp });
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

	it("月境界をまたぐ epoch を JST 基準でバケットする", () => {
		// 2024-01-31 15:30 UTC = JST 2024-02-01 00:30 → JST では 2024-02 にバケットされる
		const jstFeb1 = Date.UTC(2024, 0, 31, 15, 30); // UTC 1月、JST 2月
		// 2024-01-31 14:00 UTC = JST 2024-01-31 23:00 → JST では 2024-01 に残る
		const jstJan31 = Date.UTC(2024, 0, 31, 14, 0); // UTC 1月、JST 1月

		const answers = [
			rec({ questionId: "q1", timestamp: jstFeb1, isCorrect: true, duration: 10 }),
			rec({ questionId: "q2", timestamp: jstJan31, isCorrect: false, duration: 20 }),
		];

		const stats = aggregateByMonth(answers);

		// JST 統一後: 月境界の epoch は JST 基準で 2024-02 に入る（UTC 基準なら 2024-01 になる）
		expect(stats.map((s) => s.month)).toEqual(["2024-01", "2024-02"]);
		expect(stats[0]).toMatchObject({ month: "2024-01", totalAnswers: 1, correctAnswers: 0 });
		expect(stats[1]).toMatchObject({ month: "2024-02", totalAnswers: 1, correctAnswers: 1 });
	});
});

describe("aggregateStats", () => {
	const fixedNow = new Date(2024, 1, 1).getTime();

	it("回答ゼロなら集計は全てゼロ・trend は stable", () => {
		// Act
		const data = aggregateStats({}, fixedNow);

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
		const data = aggregateStats(history, fixedNow);

		// Assert
		expect(data.totalAttempts).toBe(3); // 全試行
		expect(data.totalAnswered).toBe(2); // ユニーク問題数
		expect(data.overallAccuracy).toBe(50); // 最新ベース: q1 正・q2 誤 → 1/2
		expect(data.avgDuration).toBe(20); // (10 + 20 + 30) / 3
	});

	it("overallMastery は着手問題数で加重した仕上がり率の平均を返す", () => {
		// Arrange: exam1-2013-q1（基数変換）正解30秒 → score≈0.925 → masteryRate=93, attempted=1
		//          exam2-2013-q1（負数表現）正解30秒 → score≈0.925 → masteryRate=93, attempted=1
		// weightedMastery = (93*1 + 93*1) / (1+1) = 93
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
			"exam2-2013-q1": [
				rec({ questionId: "exam2-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
		};

		const data = aggregateStats(history, fixedNow);

		// 両単元とも同じスコアなので overallMastery は unitMastery の masteryRate と一致する
		const baseUnit = data.unitMastery.find((u) => u.unitId === "unit-base-conversion");
		expect(data.overallMastery).toBe(baseUnit?.masteryRate);
	});

	it("overallMastery は異なる attempted 数で加重平均を返す（手計算値と一致）", () => {
		// Arrange: 基数変換 2問着手・仕上がり0% / 負数表現 1問着手・仕上がり93%
		// weightedMastery = (0*2 + 93*1) / (2+1) = 31
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: jan15, isCorrect: false, duration: 50 }),
			],
			"exam1-2014-q1": [
				rec({ questionId: "exam1-2014-q1", timestamp: jan15, isCorrect: false, duration: 50 }),
			],
			"exam2-2013-q1": [
				rec({ questionId: "exam2-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
		};

		const data = aggregateStats(history, fixedNow);

		const negUnit = data.unitMastery.find((u) => u.unitId === "unit-negative");
		const baseUnit = data.unitMastery.find((u) => u.unitId === "unit-base-conversion");
		// 手計算: (baseUnit.masteryRate * 2 + negUnit.masteryRate * 1) / (2 + 1)
		const expected = Math.round(
			((baseUnit?.masteryRate ?? 0) * 2 + (negUnit?.masteryRate ?? 0) * 1) / 3,
		);
		expect(data.overallMastery).toBe(expected);
	});

	it("overallMastery は着手がゼロなら null を返す", () => {
		const data = aggregateStats({}, fixedNow);
		expect(data.overallMastery).toBeNull();
	});

	it("masteryAttempted は単元に写像できる着手のみ数え coverage.attempted と乖離しうる", () => {
		// exam8-2013 はどの単元の examMapping にも無く mapQuestionToUnit が null（UI 到達不可だが
		// API 直呼び・過去データで answerHistory に入りうる）。表示N（masteryAttempted）と率の分母を
		// 同じ mapped 基準に揃え、coverage.attempted（全着手）との乖離を許容する。
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
			"exam8-2013-q1": [
				rec({ questionId: "exam8-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
		};
		const data = aggregateStats(history, fixedNow);
		expect(data.coverage.attempted).toBe(2); // 全着手（未写像含む）
		expect(data.masteryAttempted).toBe(1); // 写像可能な着手のみ（exam1）
	});

	it("unitMastery の linkYear は examMapping の先頭年度と一致する", () => {
		// 実際の単元データを使い、全単元で linkYear が examMapping[0].year と一致することを確認
		const history = {
			"exam1-2013-q1": [
				rec({ questionId: "exam1-2013-q1", timestamp: jan15, isCorrect: true, duration: 30 }),
			],
		};
		const data = aggregateStats(history, fixedNow);

		// 実在する全単元タブに対して linkYear が正しく設定されているか確認する
		for (const tab of unitBasedTabs) {
			const mastery = data.unitMastery.find((u) => u.unitId === tab.id);
			expect(mastery?.linkYear).toBe(tab.examMapping[0]?.year ?? "2013");
		}
	});

	it("unitMastery の linkYear: unit-base-conversion は '2013'", () => {
		const data = aggregateStats({}, fixedNow);
		const unit = data.unitMastery.find((u) => u.unitId === "unit-base-conversion");
		expect(unit?.linkYear).toBe("2013");
	});

	it("heatmap の各セルが weekday フィールドを持ち、dateKey の実曜日と一致する", () => {
		// 2024-02-01 は木曜（月曜ベース: 3）
		// fixedNow = 2024-02-01、ヒートマップ末尾セルは 2024-02-01
		const data = aggregateStats({}, fixedNow);
		const lastCell = data.heatmap.at(-1);

		// 2024-02-01 の月曜ベース曜日は木曜(3)
		expect(lastCell?.dateKey).toBe("2024-02-01");
		expect(lastCell?.weekday).toBe(3); // 月=0..日=6 で木曜=3

		// 105日前（最初のセル）も weekday フィールドを持つ
		const firstCell = data.heatmap[0];
		expect(typeof firstCell?.weekday).toBe("number");
		// 月曜ベースで 0〜6 の範囲に収まる
		expect(firstCell?.weekday).toBeGreaterThanOrEqual(0);
		expect(firstCell?.weekday).toBeLessThanOrEqual(6);
	});
});
