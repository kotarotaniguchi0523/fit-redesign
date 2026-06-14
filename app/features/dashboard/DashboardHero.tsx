/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import type { SrsSummary } from "../srs/replay";
import type { Coverage } from "./dashboardAggregator";

interface DashboardHeroProps {
	/** 仕上がり率（着手0問なら null） */
	overallMastery: number | null;
	/** overallMastery の分母＝単元に写像できる着手問題数 */
	masteryAttempted: number;
	/** 今日(JST)解いたユニーク問題数（リング分子） */
	todayCount: number;
	/** 1日の目標問題数（リング分母） */
	dailySessionGoal: number;
	/** カバレッジ着手/総数 */
	coverage: Coverage;
	/** SRS サマリー（復習の滞留カード数用） */
	srs: SrsSummary;
}

/**
 * ダッシュボード ① ヒーロー行: 4カード
 * - 仕上がり / 今日の演習SVGリング / カバレッジ / 復習の滞留
 */
export function DashboardHero({
	overallMastery,
	masteryAttempted,
	todayCount,
	dailySessionGoal,
	coverage,
	srs,
}: DashboardHeroProps): JSX.Element {
	// 今日の演習 SVG リング（表示派生値）
	const ringRadius = 36;
	const circumference = 2 * Math.PI * ringRadius;
	const ringProgress = Math.min(todayCount / dailySessionGoal, 1);
	const ringOffset = circumference * (1 - ringProgress);
	const ringColor = todayCount >= dailySessionGoal ? "stroke-emerald-500" : "stroke-[#1e3a5f]";
	// カバレッジ%（数字表示とバー幅で共用）
	const coveragePct = Math.round((coverage.attempted / coverage.total) * 100);

	return (
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
			{/* カード1: 仕上がり */}
			<div class="bg-white rounded-lg shadow-sm p-4 text-center">
				{overallMastery === null ? (
					<>
						<div class="text-2xl font-bold text-gray-400">—</div>
						<div class="text-xs text-gray-500 mt-1">まず1問解こう</div>
					</>
				) : (
					<>
						<div class="text-2xl font-bold text-[#1e3a5f]">{overallMastery}%</div>
						<div class="text-xs text-gray-500 mt-1">着手した{masteryAttempted}問の平均スコア</div>
					</>
				)}
				<div class="text-xs font-medium text-gray-700 mt-1">仕上がり</div>
			</div>

			{/* カード2: 今日の演習（SVG リング） */}
			<div class="bg-white rounded-lg shadow-sm p-4 text-center">
				<div class="flex justify-center">
					<svg
						width="88"
						height="88"
						viewBox="0 0 88 88"
						role="img"
						aria-label={`今日の演習: ${todayCount}/${dailySessionGoal}問`}
					>
						{/* 背景円 */}
						<circle cx="44" cy="44" r={ringRadius} fill="none" stroke="#e5e7eb" stroke-width="8" />
						{/* 進捗円（時計方向: transform で上端から始める） */}
						<circle
							cx="44"
							cy="44"
							r={ringRadius}
							fill="none"
							class={ringColor}
							stroke-width="8"
							stroke-dasharray={`${circumference}`}
							stroke-dashoffset={`${ringOffset}`}
							stroke-linecap="round"
							transform="rotate(-90 44 44)"
						/>
						<text
							x="44"
							y="44"
							text-anchor="middle"
							dominant-baseline="central"
							class="text-xs font-bold fill-[#1e3a5f]"
							font-size="13"
							font-weight="700"
							fill="#1e3a5f"
						>
							{todayCount}/{dailySessionGoal}問
						</text>
					</svg>
				</div>
				<div class="text-xs font-medium text-gray-700 mt-1">今日の演習</div>
			</div>

			{/* カード3: カバレッジ */}
			<div class="bg-white rounded-lg shadow-sm p-4 text-center">
				<div class="text-2xl font-bold text-[#1e3a5f]">{coveragePct}%</div>
				<div class="text-xs text-gray-500 mt-1">
					{coverage.attempted}/{coverage.total}問
				</div>
				{/* 細いプログレスバー */}
				<div class="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
					<div class="h-full bg-[#1e3a5f] rounded-full" style={`width: ${coveragePct}%`} />
				</div>
				<div class="text-xs font-medium text-gray-700 mt-1">カバレッジ</div>
			</div>

			{/* カード4: 復習の滞留 */}
			<div class="bg-white rounded-lg shadow-sm p-4 text-center">
				<div class="text-2xl font-bold text-[#1e3a5f]">{srs.overdueCount}問</div>
				<div class="text-xs text-gray-500 mt-1">
					{srs.overdueCount === 0 ? "すべて消化済み" : "期限切れの復習"}
				</div>
				<div class="text-xs font-medium text-gray-700 mt-1">復習の滞留</div>
			</div>
		</div>
	);
}
