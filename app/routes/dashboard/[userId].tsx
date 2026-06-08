/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { disableSSG } from "hono/ssg";
import { getUserAnswerHistory } from "../../server/answerRepository";
import {
	aggregateStats,
	type DashboardData,
	type UnitStats,
} from "../../utils/dashboardAggregator";

/**
 * 学習ダッシュボード（HonoX 動的ルート）。
 *
 * 旧 src/pages/dashboard/[userId].astro の SSR を移植。
 * - c.env.DB から回答履歴を読み dashboardAggregator で集計する。
 * - userId が無ければ "/" にリダイレクト（旧 Astro.redirect("/") と一致）。
 * - SSG 対象外にするため disableSSG() を付ける（SSR 専用）。
 *
 * NOTE: Layout.astro / Header.astro は Astro コンポーネントで hono/jsx へ import 不可のため、
 *   メインコンテンツのみを JSX で再現し _renderer.tsx 経由で描画する。
 *   Chart.js / dashboard island の client wiring（旧 <script>）は client.ts が凍結のため
 *   このスライスでは未対応（follow-up）。集計データは #dashboard-data に埋め込んで橋渡し可能にしておく。
 */

type Env = { Bindings: Cloudflare.Env };

const EMPTY_DASHBOARD: DashboardData = {
	totalQuestions: 0,
	totalAnswered: 0,
	totalAttempts: 0,
	overallAccuracy: 0,
	avgDuration: null,
	monthlyStats: [],
	unitStats: [],
	trend: "stable",
};

function trendIcon(trend: string): string {
	if (trend === "improving") return "↗";
	if (trend === "declining") return "↘";
	return "→";
}

function trendColor(trend: string): string {
	if (trend === "improving") return "text-emerald-600";
	if (trend === "declining") return "text-red-600";
	return "text-gray-500";
}

const app = new Hono<Env>();

app.get("/", disableSSG(), async (c) => {
	const userId = c.req.param("userId");

	if (!userId) {
		return c.redirect("/");
	}

	let dashboardData: DashboardData;
	try {
		const answerHistory = await getUserAnswerHistory(c.env.DB, userId);
		dashboardData = aggregateStats(answerHistory);
	} catch (error) {
		console.error("Dashboard data error:", error);
		dashboardData = EMPTY_DASHBOARD;
	}

	const hasData = dashboardData.totalAnswered > 0;
	const dashboardUrl = `${new URL(c.req.url).origin}/dashboard/${userId}`;

	// _renderer.tsx（凍結）が title プロップを受け取るが、ContextRenderer は既定で空
	// interface = 1 引数の DefaultRenderer 型。第 2 引数 { title } を渡すため、ここだけ
	// renderer を局所的に型付けする（global module augmentation は他テストの render に波及するため避ける）。
	const render = c.render as (
		content: string | Promise<string>,
		props: { title: string },
	) => Response | Promise<Response>;

	return render(
		<main class="max-w-4xl mx-auto px-4 py-8">
			<div class="mb-8">
				<h1 class="text-2xl font-bold text-[#1e3a5f] mb-2" style="font-family: var(--font-serif)">
					学習ダッシュボード
				</h1>
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span>共有リンク:</span>
					<code class="bg-gray-100 px-2 py-0.5 rounded text-xs break-all">{dashboardUrl}</code>
					<button
						type="button"
						id="copy-dashboard-url"
						data-url={dashboardUrl}
						class="text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors"
						title="URLをコピー"
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<title>copy</title>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
					</button>
				</div>
			</div>

			{hasData ? (
				<>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-[#1e3a5f]">{dashboardData.totalAnswered}</div>
							<div class="text-xs text-gray-500 mt-1">解いた問題数</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="relative w-20 h-20 mx-auto">
								<canvas id="accuracy-donut" width="80" height="80" />
								<div class="absolute inset-0 flex items-center justify-center">
									<span class="text-lg font-bold text-[#1e3a5f]">
										{dashboardData.overallAccuracy}%
									</span>
								</div>
							</div>
							<div class="text-xs text-gray-500 mt-1">正答率</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-[#1e3a5f]">
								{dashboardData.avgDuration ? `${dashboardData.avgDuration}s` : "-"}
							</div>
							<div class="text-xs text-gray-500 mt-1">平均回答時間</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class={`text-3xl font-bold ${trendColor(dashboardData.trend)}`}>
								{trendIcon(dashboardData.trend)}
							</div>
							<div class="text-xs text-gray-500 mt-1">成長トレンド</div>
						</div>
					</div>

					{dashboardData.monthlyStats.length > 0 && (
						<div class="bg-white rounded-lg shadow-sm p-6 mb-8">
							<h2 class="text-lg font-bold text-[#1e3a5f] mb-4">月ごとの推移</h2>
							<div class="h-64">
								<canvas id="monthly-chart" />
							</div>
						</div>
					)}

					{dashboardData.unitStats.length > 0 && (
						<div class="space-y-3">
							<h2 class="text-lg font-bold text-[#1e3a5f]">単元別</h2>
							{dashboardData.unitStats.map((unit: UnitStats) => (
								<div class="bg-white rounded-lg shadow-sm overflow-hidden">
									<button
										type="button"
										data-unit-toggle={unit.unitId}
										class="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
									>
										<div class="flex items-center gap-3">
											<span class="text-xl">{unit.unitIcon}</span>
											<div>
												<div class="font-medium text-gray-900">{unit.unitName}</div>
												<div class="text-sm text-gray-500">{unit.totalAnswers}回 回答</div>
											</div>
										</div>
										<div class="flex items-center gap-4">
											<div class="w-24 hidden sm:block">
												<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
													<div
														class="h-full bg-emerald-500 rounded-full transition-all"
														style={`width: ${unit.accuracy}%`}
													/>
												</div>
												<div class="text-xs text-gray-500 text-right mt-0.5">{unit.accuracy}%</div>
											</div>
											<span class={`text-lg ${trendColor(unit.trend)}`}>
												{trendIcon(unit.trend)}
											</span>
											<span data-arrow class="text-gray-400 text-sm">
												▶
											</span>
										</div>
									</button>
									<div
										id={`unit-detail-${unit.unitId}`}
										class="hidden border-t border-gray-100 p-4"
									>
										<table class="w-full text-sm">
											<thead>
												<tr class="text-gray-500 border-b">
													<th class="text-left py-1 font-medium">問題</th>
													<th class="text-center py-1 font-medium">回答数</th>
													<th class="text-center py-1 font-medium">最新</th>
												</tr>
											</thead>
											<tbody>
												{unit.questionDetails.map((q) => {
													const latest = q.answers[q.answers.length - 1];
													return (
														<tr class="border-b border-gray-50">
															<td class="py-1.5 text-gray-700">{q.questionId}</td>
															<td class="py-1.5 text-center text-gray-600">{q.answers.length}</td>
															<td class="py-1.5 text-center">
																{latest ? (
																	<span
																		class={latest.isCorrect ? "text-emerald-600" : "text-red-600"}
																	>
																		{latest.selectedLabel} {latest.isCorrect ? "○" : "×"}
																	</span>
																) : (
																	<span class="text-gray-400">-</span>
																)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							))}
						</div>
					)}
				</>
			) : (
				<div class="bg-white rounded-lg shadow-sm p-12 text-center">
					<div class="text-4xl mb-4">📝</div>
					<h2 class="text-lg font-bold text-gray-700 mb-2">まだ問題を解いていません</h2>
					<p class="text-gray-500 mb-6">
						問題ページで選択肢を選んで回答すると、ここに学習記録が表示されます。
					</p>
					<a
						href="/"
						class="inline-block px-6 py-2.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d4a6f] transition-colors"
					>
						問題を解く
					</a>
				</div>
			)}

			<script
				id="dashboard-data"
				type="application/json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Chart.js 用の集計データ受け渡し（旧 Astro set:html と同等）
				dangerouslySetInnerHTML={{ __html: JSON.stringify(dashboardData) }}
			/>
		</main>,
		{ title: "学習ダッシュボード" },
	);
});

export default app;
