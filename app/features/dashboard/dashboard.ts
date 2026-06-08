import {
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	DoughnutController,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";

// Tree-shake: 必要なモジュールのみ登録
Chart.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	LineController,
	BarController,
	DoughnutController,
	Legend,
	Tooltip,
);

interface MonthlyStats {
	month: string;
	totalAnswers: number;
	correctAnswers: number;
	accuracy: number;
	avgDuration: number | null;
}

// ドーナツチャート（全体正答率）
function renderAccuracyDonut(canvasId: string, accuracy: number) {
	const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
	if (!canvas) return;

	new Chart(canvas, {
		type: "doughnut",
		data: {
			labels: ["正解", "不正解"],
			datasets: [
				{
					data: [accuracy, 100 - accuracy],
					backgroundColor: ["#10b981", "#e5e7eb"],
					borderWidth: 0,
				},
			],
		},
		options: {
			cutout: "70%",
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: { display: false },
				tooltip: { enabled: false },
			},
		},
	});
}

// 月ごと推移グラフ（折れ線 + バー複合）
function renderMonthlyChart(canvasId: string, monthlyStats: MonthlyStats[]) {
	const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
	if (!canvas) return;

	const labels = monthlyStats.map((m) => {
		const [year, month] = m.month.split("-");
		return `${year}/${month}`;
	});

	new Chart(canvas, {
		type: "bar",
		data: {
			labels,
			datasets: [
				{
					type: "line",
					label: "正答率 (%)",
					data: monthlyStats.map((m) => m.accuracy),
					borderColor: "#1e3a5f",
					backgroundColor: "rgba(30, 58, 95, 0.1)",
					fill: true,
					tension: 0.3,
					yAxisID: "y",
					pointRadius: 4,
					pointBackgroundColor: "#1e3a5f",
				},
				{
					type: "bar",
					label: "回答数",
					data: monthlyStats.map((m) => m.totalAnswers),
					backgroundColor: "rgba(201, 162, 39, 0.6)",
					borderColor: "#c9a227",
					borderWidth: 1,
					yAxisID: "y1",
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			scales: {
				y: {
					type: "linear",
					position: "left",
					min: 0,
					max: 100,
					title: { display: true, text: "正答率 (%)" },
				},
				y1: {
					type: "linear",
					position: "right",
					min: 0,
					grid: { drawOnChartArea: false },
					title: { display: true, text: "回答数" },
				},
			},
			plugins: {
				legend: { position: "bottom" },
			},
		},
	});
}

// ページ初期化
function init() {
	const dataEl = document.getElementById("dashboard-data");
	if (!dataEl) return;

	try {
		const data = JSON.parse(dataEl.textContent ?? "{}");

		if (data.overallAccuracy !== undefined) {
			renderAccuracyDonut("accuracy-donut", data.overallAccuracy);
		}

		if (data.monthlyStats?.length > 0) {
			renderMonthlyChart("monthly-chart", data.monthlyStats);
		}
	} catch (e) {
		console.error("Dashboard init error:", e);
	}

	// 単元カードの展開トグル
	document.querySelectorAll<HTMLButtonElement>("[data-unit-toggle]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const targetId = btn.dataset.unitToggle;
			const target = document.getElementById(`unit-detail-${targetId}`);
			if (target) {
				target.classList.toggle("hidden");
				const arrow = btn.querySelector("[data-arrow]");
				if (arrow) {
					arrow.textContent = target.classList.contains("hidden") ? "▶" : "▼";
				}
			}
		});
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
