/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { disableSSG } from "hono/ssg";
import CopyButton from "../../components/$CopyButton";
import { DashboardDataScript } from "../../features/dashboard/DashboardDataScript";
import { DashboardHero } from "../../features/dashboard/DashboardHero";
import {
	aggregateStats,
	type DashboardData,
	TOTAL_QUESTIONS,
} from "../../features/dashboard/dashboardAggregator";
import { buildHeatmapGrid } from "../../features/dashboard/dashboardView";
import { Heatmap } from "../../features/dashboard/Heatmap";
import { MasteryBreakdown } from "../../features/dashboard/MasteryBreakdown";
import { TrendCharts } from "../../features/dashboard/TrendCharts";
import { WeaknessPanel } from "../../features/dashboard/WeaknessPanel";
import { deriveSrsFromHistory, type SrsSummary, summarizeSrs } from "../../features/srs/replay";
import { DAILY_SESSION_MAX } from "../../features/srs/srs";
import { getUserAnswerHistory } from "../../server/answerRepository";
import type { Db } from "../../server/schema";
import type { UserIdentityVariables } from "../../server/userIdentity";
import { type UserId, UserIdSchema } from "../../types";

/**
 * 学習ダッシュボード（HonoX 動的ルート）。
 *
 * ユーザー別ダッシュボード（D1 集計の SSR）。
 * - c.var.db（Drizzle）から回答履歴を読み dashboardAggregator で集計する。
 * - userId が無ければ "/" にリダイレクト。
 * - SSG 対象外にするため disableSSG() を付ける（SSR 専用）。
 *
 * メインコンテンツを JSX で組み、共有レイアウト（Header 等）は _renderer.tsx 経由で描画する。
 * Chart.js は集計データを #dashboard-data に埋め込み、app/client.ts が同要素を検出した時だけ
 * dashboard チャートモジュールを遅延 import して描画する。
 * hasData=true の時のみ DashboardDataScript を出力するため、無回答ユーザーで chart.js は読まれない。
 */

type Env = { Bindings: Cloudflare.Env; Variables: UserIdentityVariables };

const dailySessionGoal = DAILY_SESSION_MAX;

const EMPTY_DASHBOARD: DashboardData = {
	totalAnswered: 0,
	totalAttempts: 0,
	overallAccuracy: 0,
	avgDuration: null,
	monthlyStats: [],
	unitStats: [],
	trend: "stable",
	dailyStats: [],
	weeklyStats: [],
	heatmap: [],
	todayCount: 0,
	coverage: { attempted: 0, total: TOTAL_QUESTIONS },
	unitMastery: [],
	weakUnits: [],
	weakQuestions: [],
	setTimes: [],
	overallMastery: null,
	masteryAttempted: 0,
};

const EMPTY_SRS: SrsSummary = {
	seenCount: 0,
	overdueCount: 0,
	stages: { learning: 0, takingHold: 0, mastered: 0 },
};

interface LoadedDashboardData {
	dashboardData: DashboardData;
	srs: SrsSummary;
}

async function loadDashboardData(db: Db, userId: UserId): Promise<LoadedDashboardData> {
	try {
		const answerHistory = await getUserAnswerHistory(db, userId);
		const now = Date.now();
		const dashboardData = aggregateStats(answerHistory, now);
		const srs = summarizeSrs(deriveSrsFromHistory(answerHistory), now);
		return { dashboardData, srs };
	} catch (error) {
		console.error("Dashboard data error:", error);
		return { dashboardData: EMPTY_DASHBOARD, srs: EMPTY_SRS };
	}
}

const app = new Hono<Env>();

app.get("/", disableSSG(), async (c) => {
	const parsedUserId = UserIdSchema.safeParse(c.req.param("userId"));

	if (!parsedUserId.success) {
		return c.redirect(`/dashboard/${c.var.userId}`);
	}

	const userId = parsedUserId.data;
	const { dashboardData, srs } = await loadDashboardData(c.var.db, userId);
	const hasData = dashboardData.totalAnswered > 0;
	const dashboardUrl = `${new URL(c.req.url).origin}/dashboard/${userId}`;

	// ヒートマップグリッド（グリッド構築のみ; 列キー・曜日ラベルは Heatmap が導出）
	const heatmapGrid = buildHeatmapGrid(dashboardData.heatmap);

	// Chart.js（推移グラフ）が使う 3 粒度のみを #dashboard-data へ（重い unitStats/weakQuestions 等は載せない）
	const chartData = {
		monthlyStats: dashboardData.monthlyStats,
		dailyStats: dashboardData.dailyStats,
		weeklyStats: dashboardData.weeklyStats,
	};

	// _renderer.tsx（凍結）が title プロップを受け取るが、ContextRenderer は既定で空
	// interface = 1 引数の DefaultRenderer 型。第 2 引数 { title } を渡すため、ここだけ
	// renderer を局所的に型付けする（global module augmentation は他テストの render に波及するため避ける）。
	const render = c.render as (
		content: string | Promise<string>,
		props: { title: string },
	) => Response | Promise<Response>;

	return render(
		<main class="max-w-4xl mx-auto px-4 py-8">
			{/* ヘッダー：共有リンク */}
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
					{/* ① ヒーロー行: 4 カード */}
					<DashboardHero
						overallMastery={dashboardData.overallMastery}
						masteryAttempted={dashboardData.masteryAttempted}
						todayCount={dashboardData.todayCount}
						dailySessionGoal={dailySessionGoal}
						coverage={dashboardData.coverage}
						srs={srs}
					/>

					{/* ② 仕上がりの内訳 */}
					<MasteryBreakdown
						srs={srs}
						unitMastery={dashboardData.unitMastery}
						setTimes={dashboardData.setTimes}
						unitStats={dashboardData.unitStats}
					/>

					{/* ③ 弱点診断 */}
					<WeaknessPanel
						weakUnits={dashboardData.weakUnits}
						unitMastery={dashboardData.unitMastery}
						weakQuestions={dashboardData.weakQuestions}
					/>

					{/* ④ 推移グラフ（トグル + canvas） */}
					<TrendCharts monthlyStats={dashboardData.monthlyStats} />

					{/* ⑤ 学習ヒートマップ */}
					<Heatmap heatmapGrid={heatmapGrid} />

					{/* Chart.js 用データ：hasData 時のみ出力（無回答ユーザーで chart.js を読まない最適化） */}
					<DashboardDataScript chartData={chartData} />
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
		</main>,
		{ title: "学習ダッシュボード" },
	);
});

export default app;
