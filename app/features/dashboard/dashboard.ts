import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";

// Tree-shake: 必要なモジュールのみ登録（DoughnutController/ArcElement は donut 廃止に伴い除去）
Chart.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	LineController,
	BarController,
	Legend,
	Tooltip,
);

import type { MonthlyStats, PeriodStats } from "./dashboardAggregator";

// トグルが選択する粒度。GRANULARITIES を単一の真実源にして型も導出する。
const GRANULARITIES = ["day", "week", "month"] as const;
type Granularity = (typeof GRANULARITIES)[number];

function isGranularity(value: string | undefined): value is Granularity {
	return GRANULARITIES.some((granularity) => granularity === value);
}

// 2チャートへ流す共通系列型
interface ChartSeries {
	labels: string[];
	accuracy: number[];
	counts: number[];
}

// accuracy/totalAnswers を持つ統計配列 + ラベル取得関数から系列を作る（粒度間の重複を一本化）。
function buildSeries<T extends { accuracy: number; totalAnswers: number }>(
	items: T[],
	getLabel: (item: T) => string,
): ChartSeries {
	return {
		labels: items.map(getLabel),
		accuracy: items.map((item) => item.accuracy),
		counts: items.map((item) => item.totalAnswers),
	};
}

// 粒度に応じた ChartSeries を返すセレクタ（月ラベルは "YYYY-MM" → "YYYY/MM"）。
function selectSeries(
	granularity: Granularity,
	dailyStats: PeriodStats[],
	weeklyStats: PeriodStats[],
	monthlyStats: MonthlyStats[],
): ChartSeries {
	if (granularity === "day") {
		return buildSeries(dailyStats, (stat) => stat.label);
	}
	if (granularity === "week") {
		return buildSeries(weeklyStats, (stat) => stat.label);
	}
	return buildSeries(monthlyStats, (stat) => stat.month.replace("-", "/"));
}

// canvas を型安全に取得（要素が無い/canvas でなければ null）。
function getCanvas(canvasId: string): HTMLCanvasElement | null {
	const element = document.getElementById(canvasId);
	return element instanceof HTMLCanvasElement ? element : null;
}

// 正答率推移チャートを生成して Chart インスタンスを返す（折れ線・Y 0-100%）。
function createAccuracyTrendChart(canvasId: string, series: ChartSeries): Chart | null {
	const canvas = getCanvas(canvasId);
	if (!canvas) {
		return null;
	}

	return new Chart(canvas, {
		type: "line",
		data: {
			labels: series.labels,
			datasets: [
				{
					label: "正答率 (%)",
					data: series.accuracy,
					borderColor: "#1e3a5f",
					backgroundColor: "rgba(30, 58, 95, 0.1)",
					fill: true,
					tension: 0.3,
					pointRadius: 4,
					pointBackgroundColor: "#1e3a5f",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					min: 0,
					max: 100,
					ticks: { callback: (value): string => `${value}%` },
				},
			},
			plugins: { legend: { display: false } },
		},
	});
}

// 回答数推移チャートを生成して Chart インスタンスを返す（棒・整数目盛）。
function createAnswerCountChart(canvasId: string, series: ChartSeries): Chart | null {
	const canvas = getCanvas(canvasId);
	if (!canvas) {
		return null;
	}

	return new Chart(canvas, {
		type: "bar",
		data: {
			labels: series.labels,
			datasets: [
				{
					label: "回答数",
					data: series.counts,
					backgroundColor: "rgba(201, 162, 39, 0.6)",
					borderColor: "#c9a227",
					borderWidth: 1,
					borderRadius: 4,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: { min: 0, ticks: { precision: 0 } },
			},
			plugins: { legend: { display: false } },
		},
	});
}

// 選択中ボタンの aria-pressed と active スタイルを付け替える。
function updateToggleState(buttons: HTMLButtonElement[], active: HTMLButtonElement): void {
	buttons.map((button) => {
		const isActive = button === active;
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
		button.classList.toggle("bg-[#1e3a5f]", isActive);
		button.classList.toggle("text-white", isActive);
		button.classList.toggle("bg-gray-100", !isActive);
		button.classList.toggle("text-gray-600", !isActive);
		return button;
	});
}

// ページ初期化
function init(): void {
	const dataElement = document.getElementById("dashboard-data");
	if (!dataElement) {
		return;
	}

	try {
		const data = JSON.parse(dataElement.textContent ?? "{}");

		// 各粒度データを取得（古いデータで欠けていてもガード）
		const monthlyStats: MonthlyStats[] = data.monthlyStats ?? [];
		const dailyStats: PeriodStats[] = data.dailyStats ?? [];
		const weeklyStats: PeriodStats[] = data.weeklyStats ?? [];

		// 推移グラフが描画できるデータがない場合はスキップ
		if (weeklyStats.length === 0 && dailyStats.length === 0 && monthlyStats.length === 0) {
			return;
		}

		// 既定=週次で初期描画
		const initialSeries = selectSeries("week", dailyStats, weeklyStats, monthlyStats);
		const trendChart = createAccuracyTrendChart("accuracy-trend", initialSeries);
		const countChart = createAnswerCountChart("answer-count", initialSeries);

		// チャートが生成できなかった場合（canvas 要素なし）はトグル配線しない
		if (!(trendChart && countChart)) {
			return;
		}

		// 粒度トグルのボタン群を取得して click リスナを配線
		const toggleContainer = document.getElementById("trend-granularity-toggle");
		if (!toggleContainer) {
			return;
		}

		const buttons = Array.from(
			toggleContainer.querySelectorAll<HTMLButtonElement>("button[data-granularity]"),
		);

		buttons.map((button) => {
			button.addEventListener("click", () => {
				const granularity = button.dataset.granularity;
				if (!isGranularity(granularity)) {
					return;
				}

				// 系列を選択してチャートデータを差し替え、再描画する（再フェッチなし）
				const series = selectSeries(granularity, dailyStats, weeklyStats, monthlyStats);

				trendChart.data.labels = series.labels;
				trendChart.data.datasets[0].data = series.accuracy;
				trendChart.update();

				countChart.data.labels = series.labels;
				countChart.data.datasets[0].data = series.counts;
				countChart.update();

				updateToggleState(buttons, button);
			});
			return button;
		});
	} catch (error) {
		console.error("Dashboard init error:", error);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
