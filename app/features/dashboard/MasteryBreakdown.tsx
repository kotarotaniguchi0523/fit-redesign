/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import type { SrsSummary } from "../srs/replay";
import type { SetTime, UnitMastery, UnitStats } from "./dashboardAggregator";
import { TOTAL_QUESTIONS } from "./dashboardAggregator";
import { UnitMasteryRow } from "./UnitMasteryRow";

interface MasteryBreakdownProps {
	/** SRS サマリー（記憶の定着スタックバー用） */
	srs: SrsSummary;
	/** 単元別仕上がりリスト */
	unitMastery: UnitMastery[];
	/** 最新完走セット配列（単元ID → SetTime のマップをコンポーネント内で構築する） */
	setTimes: SetTime[];
	/** 問題別詳細配列（単元ID → UnitStats のマップをコンポーネント内で構築する） */
	unitStats: UnitStats[];
}

/** SRS スタックバーの幅%（全問数に対する割合）。 */
function srsBarPct(count: number): number {
	return Math.round((count / TOTAL_QUESTIONS) * 100);
}

/**
 * ダッシュボード ② 仕上がりの内訳
 * - 記憶の定着（間隔反復）スタックバー
 * - 仕上がり率（単元別）行
 */
export function MasteryBreakdown({
	srs,
	unitMastery,
	setTimes,
	unitStats,
}: MasteryBreakdownProps): JSX.Element {
	// Map はコンポーネント内で構築（ルートで O(N) 索引を作り Props に渡す必要がない）。
	const setTimeByUnit = new Map(setTimes.map((st) => [st.unitId, st]));
	const unitStatsByUnit = new Map(unitStats.map((us) => [us.unitId, us]));
	// 未学習問題数 = 全問数 - SRS が把握している着手済み問題数。
	const unseenCount = TOTAL_QUESTIONS - srs.seenCount;
	return (
		<div class="mb-8">
			<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">仕上がりの内訳</h2>

			{/* 記憶の定着（間隔反復）スタックバー */}
			<div class="bg-white rounded-lg shadow-sm p-6 mb-4">
				<h3 class="text-sm font-semibold text-gray-700 mb-3">記憶の定着（間隔反復）</h3>
				{/* スタックバー */}
				<div class="flex h-4 rounded-full overflow-hidden w-full mb-3">
					<div
						class="bg-emerald-700 transition-all"
						style={`width: ${srsBarPct(srs.stages.mastered)}%`}
						title={`定着 ${srs.stages.mastered}問`}
					/>
					<div
						class="bg-emerald-400 transition-all"
						style={`width: ${srsBarPct(srs.stages.takingHold)}%`}
						title={`定着しかけ ${srs.stages.takingHold}問`}
					/>
					<div
						class="bg-blue-300 transition-all"
						style={`width: ${srsBarPct(srs.stages.learning)}%`}
						title={`学習中 ${srs.stages.learning}問`}
					/>
					<div class="bg-gray-200 transition-all flex-1" title={`未学習 ${unseenCount}問`} />
				</div>
				{/* 凡例 */}
				<div class="flex flex-wrap gap-3 text-xs text-gray-600">
					<span class="flex items-center gap-1">
						<span class="inline-block w-3 h-3 rounded-sm bg-emerald-700" />
						定着 {srs.stages.mastered}問
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-3 h-3 rounded-sm bg-emerald-400" />
						定着しかけ {srs.stages.takingHold}問
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-3 h-3 rounded-sm bg-blue-300" />
						学習中 {srs.stages.learning}問
					</span>
					<span class="flex items-center gap-1">
						<span class="inline-block w-3 h-3 rounded-sm bg-gray-200" />
						未学習 {unseenCount}問
					</span>
				</div>
			</div>

			{/* 仕上がり率（単元別） */}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold text-gray-700">仕上がり率（正確性×速度）: 単元別</h3>
				{unitMastery.map((mastery) => (
					<UnitMasteryRow
						key={mastery.unitId}
						mastery={mastery}
						setTime={setTimeByUnit.get(mastery.unitId)}
						unitStats={unitStatsByUnit.get(mastery.unitId)}
					/>
				))}
			</div>
		</div>
	);
}
