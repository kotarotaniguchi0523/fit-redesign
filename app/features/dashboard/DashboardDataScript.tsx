/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import type { MonthlyStats, PeriodStats } from "./dashboardAggregator";

/** Chart.js が必要とする3粒度のデータ（重い unitStats/weakQuestions 等は除外）。 */
interface ChartData {
	monthlyStats: MonthlyStats[];
	dailyStats: PeriodStats[];
	weeklyStats: PeriodStats[];
}

interface DashboardDataScriptProps {
	/** Chart.js が参照する3粒度のチャートデータ */
	chartData: ChartData;
}

/**
 * Chart.js（推移グラフ）へデータを渡す #dashboard-data script 要素。
 * app/client.ts がこの要素を検出した時のみ chart.js チャンクを動的 import する。
 * hasData=true の時のみレンダリングすることで、無回答ユーザーで chart.js を読まない最適化ができる。
 */
export function DashboardDataScript({ chartData }: DashboardDataScriptProps): JSX.Element {
	return (
		<script
			id="dashboard-data"
			type="application/json"
			// `<` を < へエスケープし、データ中に </script> 等が現れても script 要素が早期終了しないようにする（防御）。
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Chart.js 用の粒度データ受け渡し（クライアントの Chart.js へ受け渡し）
			dangerouslySetInnerHTML={{ __html: JSON.stringify(chartData).replace(/</g, "\\u003c") }}
		/>
	);
}
