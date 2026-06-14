/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import type { MonthlyStats } from "./dashboardAggregator";

interface TrendChartsProps {
	/** 月次統計（0件の場合はセクション自体を非表示） */
	monthlyStats: MonthlyStats[];
}

/**
 * ダッシュボード ④ 推移グラフ（トグル + canvas）
 * 粒度トグル（日/週/月）と chart.js 描画用 canvas を含む静的マークアップ。
 * 既定は週次だが、休眠ユーザー（直近12週に活動なし）でも月次へ切替できるよう、
 * いずれかの粒度にデータがあれば描画する（monthlyStats は hasData 下で常に非空）。
 */
export function TrendCharts({ monthlyStats }: TrendChartsProps): JSX.Element | null {
	if (monthlyStats.length === 0) {
		return null;
	}

	return (
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
			<div class="bg-white rounded-lg shadow-sm p-6">
				{/* 粒度トグル */}
				<div id="trend-granularity-toggle" class="flex gap-1 mb-4">
					<button
						type="button"
						data-granularity="day"
						aria-pressed="false"
						class="px-3 py-1 rounded text-sm bg-gray-100 text-gray-600"
					>
						日
					</button>
					<button
						type="button"
						data-granularity="week"
						aria-pressed="true"
						class="px-3 py-1 rounded text-sm bg-[#1e3a5f] text-white"
					>
						週
					</button>
					<button
						type="button"
						data-granularity="month"
						aria-pressed="false"
						class="px-3 py-1 rounded text-sm bg-gray-100 text-gray-600"
					>
						月
					</button>
				</div>
				<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">正答率の推移</h2>
				<div class="h-64">
					<canvas id="accuracy-trend" />
				</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">回答数の推移</h2>
				<div class="h-64">
					<canvas id="answer-count" />
				</div>
			</div>
		</div>
	);
}
