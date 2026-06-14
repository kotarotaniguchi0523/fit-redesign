import { type HeatmapCell, mapQuestionToUnit, parseQuestionId } from "./dashboardAggregator";

/**
 * 苦手問題（questionId）の遷移先 URL。単元へ写像できなければ演習一覧へフォールバック。
 */
export function weakQuestionHref(questionId: string): string {
	const unitId = mapQuestionToUnit(questionId);
	if (!unitId) {
		return "/exercises";
	}
	const year = parseQuestionId(questionId)?.year ?? "2013";
	return `/${unitId}/${year}`;
}

/**
 * 秒数を "N分M秒" 形式の文字列に変換する。
 * - 0秒 → "0秒"
 * - 60秒未満 → "N秒"
 * - 60秒以上 → "M分N秒"（N=0 も含める）
 */
export function formatSetTime(totalSeconds: number): string {
	if (totalSeconds === 0) {
		return "0秒";
	}
	if (totalSeconds < 60) {
		return `${totalSeconds}秒`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}分${seconds}秒`;
}

/**
 * 回答数に応じたヒートマップセルの Tailwind クラスを返す。
 * 0 → bg-gray-100
 * 1-2 → bg-emerald-200
 * 3-5 → bg-emerald-400
 * 6-9 → bg-emerald-600
 * 10+ → bg-emerald-800
 */
export function heatmapCellColor(count: number): string {
	if (count === 0) {
		return "bg-gray-100";
	}
	if (count <= 2) {
		return "bg-emerald-200";
	}
	if (count <= 5) {
		return "bg-emerald-400";
	}
	if (count <= 9) {
		return "bg-emerald-600";
	}
	return "bg-emerald-800";
}

/**
 * 105 セルのフラット配列を 7 行 × N週 の 2D 配列に整形する。
 * - rows[0] = 月曜行, rows[6] = 日曜行
 * - 最初のセルの weekday フィールドに応じて先頭を null で埋める（配置のみ担当）
 * - 戻り値: (HeatmapCell | null)[][] （7行、各行の長さは同一）
 */
export function buildHeatmapGrid(cells: HeatmapCell[]): (HeatmapCell | null)[][] {
	if (cells.length === 0) {
		return Array.from({ length: 7 }, () => []);
	}

	const firstCell = cells[0];
	const leadingEmpty = firstCell.weekday;
	const totalCols = Math.ceil((cells.length + leadingEmpty) / 7);

	// 7 行 × totalCols 列のグリッドを null で初期化する
	const grid: (HeatmapCell | null)[][] = Array.from({ length: 7 }, () =>
		Array.from<null>({ length: totalCols }).fill(null),
	);

	// フラット配列を (row, col) に配置する（reduce で明示的に grid を返す）
	cells.reduce((accumulator, cell, index) => {
		const flatIndex = leadingEmpty + index;
		const col = Math.floor(flatIndex / 7);
		const row = flatIndex % 7;
		accumulator[row][col] = cell;
		return accumulator;
	}, grid);

	return grid;
}
