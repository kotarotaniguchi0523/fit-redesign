import { bench, describe } from "vitest";
import { groupRowsByQuestion } from "../../server/answerRepository";
import { aggregateStats } from "./dashboardAggregator";
import { makeRows, oldAggregateStats, oldGroupRowsByQuestion } from "./dashboardAggregator.golden";

/**
 * dashboard 計算ホットパスの before/after ベンチ。
 *
 * 対象:
 *  - aggregateStats（grouped history → DashboardData）
 *  - groupRowsByQuestion（D1 行 → Record<questionId, AnswerRecord[]>）の reduce 相当
 *
 * 旧実装（最適化前）は dashboardAggregator.golden.ts に保持し、同一合成データで
 * before/after を同条件比較する。equivalence は dashboardAggregator.equivalence.test.ts が
 * deep-equal で担保する。
 *
 * 実行: rtk proxy pnpm exec vitest bench --run app/features/dashboard/dashboardAggregator.bench.ts
 * （素の vitest は出力が化けるため RTK 迂回必須）
 */

const SIZES = [
	{ label: "small(50)", count: 50 },
	{ label: "medium(1000)", count: 1000 },
	{ label: "large(20000)", count: 20_000 },
] as const;

for (const { label, count } of SIZES) {
	const rows = makeRows(count);
	const history = groupRowsByQuestion(rows);

	// time: 3000 で sample 数を増やし rme を下げる（large は 1 反復が ms 級で
	// デフォルト 500ms だと sample が数十件しか出ず GC 変動に支配されるため）。
	describe(`groupRowsByQuestion ${label}`, () => {
		bench(
			"new (1-pass plain obj)",
			() => {
				groupRowsByQuestion(rows);
			},
			{ time: 3000 },
		);
		bench(
			"old (reduce spread O(m^2))",
			() => {
				oldGroupRowsByQuestion(rows);
			},
			{ time: 3000 },
		);
	});

	describe(`aggregateStats ${label}`, () => {
		bench(
			"new (1-pass)",
			() => {
				aggregateStats(history);
			},
			{ time: 3000 },
		);
		bench(
			"old (4-walk + flat)",
			() => {
				oldAggregateStats(history);
			},
			{ time: 3000 },
		);
	});
}
