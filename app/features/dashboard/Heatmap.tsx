/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import type { HeatmapCell } from "./dashboardAggregator";
import { heatmapCellColor } from "./dashboardView";

interface HeatmapProps {
	/** 7行×N週の2Dグリッド（null はパディングセル） */
	heatmapGrid: (HeatmapCell | null)[][];
}

/**
 * ダッシュボード ⑤ 学習ヒートマップ
 * - 曜日ラベル列 + セルグリッド（週単位で列を積む）
 * - 凡例
 * heatmapGrid が空（heatmap データ無し）の場合はセクション全体を非表示。
 */
export function Heatmap({ heatmapGrid }: HeatmapProps): JSX.Element | null {
	// 曜日ラベルと列キーはグリッドから導出する（ルートでなくコンポーネントが保持）。
	const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];
	const heatmapColKeys =
		heatmapGrid[0]?.map(
			(_, colIndex) =>
				heatmapGrid.find((row) => row[colIndex])?.[colIndex]?.dateKey ?? `pad-${colIndex}`,
		) ?? [];
	// すべての行が空配列の場合はデータ無し
	const hasHeatmapData = heatmapGrid.some((row) => row.length > 0);
	if (!hasHeatmapData) {
		return null;
	}

	return (
		<div class="bg-white rounded-lg shadow-sm p-6 mb-8">
			<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">学習ヒートマップ</h2>
			<div class="flex gap-1">
				{/* 曜日ラベル列 */}
				<div class="flex flex-col gap-0.5 mr-1">
					{weekdayLabels.map((label) => (
						<div
							key={label}
							class="w-3 h-3 flex items-center justify-center text-[8px] text-gray-400"
						>
							{label}
						</div>
					))}
				</div>
				{/* セルグリッド（週単位で列を積む）
				    列キー = 列の最初の非 null セルの dateKey、行キー = 曜日ラベル */}
				<div class="flex gap-0.5 overflow-x-auto">
					{heatmapColKeys.map((colKey, colIndex) => (
						<div key={colKey} class="flex flex-col gap-0.5">
							{heatmapGrid.map((row, rowIndex) => {
								const cell = row[colIndex];
								const rowKey = weekdayLabels[rowIndex] ?? `row-${rowIndex}`;
								return cell ? (
									<div
										key={cell.dateKey}
										class={`w-3 h-3 rounded-sm ${heatmapCellColor(cell.count)}`}
										title={`${cell.label} ${cell.count}問`}
									/>
								) : (
									<div key={`${colKey}-${rowKey}`} class="w-3 h-3" />
								);
							})}
						</div>
					))}
				</div>
			</div>
			{/* 凡例 */}
			<div class="flex items-center gap-1 mt-3 text-xs text-gray-400">
				<span>少</span>
				<div class="w-3 h-3 rounded-sm bg-gray-100" />
				<div class="w-3 h-3 rounded-sm bg-emerald-200" />
				<div class="w-3 h-3 rounded-sm bg-emerald-400" />
				<div class="w-3 h-3 rounded-sm bg-emerald-600" />
				<div class="w-3 h-3 rounded-sm bg-emerald-800" />
				<span>多</span>
			</div>
		</div>
	);
}
