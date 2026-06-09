/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { disableSSG } from "hono/ssg";
import UnitDetails from "../../features/dashboard/$UnitDetails";
import { aggregateStats, type DashboardData } from "../../features/dashboard/dashboardAggregator";
import CopyButton from "../../features/markdown/$CopyButton";
import { getUserAnswerHistory } from "../../server/answerRepository";

/**
 * 学習ダッシュボード（HonoX 動的ルート）。
 *
 * ユーザー別ダッシュボード（D1 集計の SSR）。
 * - c.env.DB から回答履歴を読み dashboardAggregator で集計する。
 * - userId が無ければ "/" にリダイレクト。
 * - SSG 対象外にするため disableSSG() を付ける（SSR 専用）。
 *
 * メインコンテンツを JSX で組み、共有レイアウト（Header 等）は _renderer.tsx 経由で描画する。
 * Chart.js は集計データを #dashboard-data に埋め込み、app/client.ts が同要素を検出した時だけ
 * dashboard チャートモジュールを遅延 import して描画する。
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
					<CopyButton
						text={dashboardUrl}
						className="text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors"
						ariaLabel="URLをコピー"
						title="URLをコピー"
					/>
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
							{dashboardData.unitStats.map((unit) => (
								<UnitDetails
									unit={unit}
									trendIcon={trendIcon(unit.trend)}
									trendClass={trendColor(unit.trend)}
								/>
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
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Chart.js 用の集計データ受け渡し（クライアントの Chart.js へ受け渡し）
				dangerouslySetInnerHTML={{ __html: JSON.stringify(dashboardData) }}
			/>
		</main>,
		{ title: "学習ダッシュボード" },
	);
});

export default app;
