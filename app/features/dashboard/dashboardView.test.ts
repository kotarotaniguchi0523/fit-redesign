import { describe, expect, it } from "vitest";
import { type HeatmapCell, mapQuestionToUnit } from "./dashboardAggregator";
import {
	buildHeatmapGrid,
	formatSetTime,
	heatmapCellColor,
	weakQuestionHref,
} from "./dashboardView";

describe("formatSetTime", () => {
	it("0秒 → '0秒'", () => {
		expect(formatSetTime(0)).toBe("0秒");
	});

	it("45秒 → '45秒'", () => {
		expect(formatSetTime(45)).toBe("45秒");
	});

	it("60秒 → '1分0秒'", () => {
		expect(formatSetTime(60)).toBe("1分0秒");
	});

	it("225秒 → '3分45秒'", () => {
		expect(formatSetTime(225)).toBe("3分45秒");
	});
});

describe("heatmapCellColor", () => {
	it("0 → 'bg-gray-100'", () => {
		expect(heatmapCellColor(0)).toBe("bg-gray-100");
	});

	it("1 → 'bg-emerald-200'", () => {
		expect(heatmapCellColor(1)).toBe("bg-emerald-200");
	});

	it("2 → 'bg-emerald-200'", () => {
		expect(heatmapCellColor(2)).toBe("bg-emerald-200");
	});

	it("3 → 'bg-emerald-400'", () => {
		expect(heatmapCellColor(3)).toBe("bg-emerald-400");
	});

	it("5 → 'bg-emerald-400'", () => {
		expect(heatmapCellColor(5)).toBe("bg-emerald-400");
	});

	it("6 → 'bg-emerald-600'", () => {
		expect(heatmapCellColor(6)).toBe("bg-emerald-600");
	});

	it("9 → 'bg-emerald-600'", () => {
		expect(heatmapCellColor(9)).toBe("bg-emerald-600");
	});

	it("10 → 'bg-emerald-800'", () => {
		expect(heatmapCellColor(10)).toBe("bg-emerald-800");
	});
});

describe("buildHeatmapGrid", () => {
	// 2026-06-11（木曜）始まりの 105 セルを作成する
	// 月曜ベース: 木=3 → 先頭 3 個が null
	// weekday は月曜ベース (月=0..日=6) で計算する（jstWeekdayMondayBased と同じ算出式）
	function makeCells(count: number, startDateKey = "2026-06-11"): HeatmapCell[] {
		const parts = startDateKey.split("-");
		const startMs = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		const dayMs = 24 * 60 * 60 * 1000;
		return Array.from({ length: count }, (_, index) => {
			const ms = startMs + index * dayMs;
			const date = new Date(ms);
			const year = date.getUTCFullYear();
			const month = String(date.getUTCMonth() + 1).padStart(2, "0");
			const day = String(date.getUTCDate()).padStart(2, "0");
			const sundayBased = date.getUTCDay(); // UTC正午と同じカレンダー日付なので UTC で取得
			const weekday = (sundayBased + 6) % 7;
			return {
				dateKey: `${year}-${month}-${day}`,
				label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
				count: index % 5, // テスト用の任意の値
				weekday,
			};
		});
	}

	it("105 セル入力で 7 行のグリッドを返す", () => {
		const cells = makeCells(105);
		const grid = buildHeatmapGrid(cells);
		expect(grid).toHaveLength(7);
	});

	it("各行の長さが同一（totalCols）である", () => {
		const cells = makeCells(105);
		const grid = buildHeatmapGrid(cells);
		const colCount = grid[0].length;
		expect(colCount).toBeGreaterThan(0);
		expect(grid.every((row) => row.length === colCount)).toBe(true);
	});

	it("先頭の null 数が最初のセルの曜日インデックスと一致する", () => {
		// 2026-06-11 は木曜（月曜ベース: 3）→ 第1列の月・火・水行が null
		// leadingEmpty=3: flatIndex 0→(row=0,col=0), 1→(row=1,col=0), 2→(row=2,col=0) が null
		const cells = makeCells(105, "2026-06-11");
		const grid = buildHeatmapGrid(cells);
		// 第1列（col=0）の月曜・火曜・水曜行が null
		expect(grid[0][0]).toBeNull(); // 月曜 col0
		expect(grid[1][0]).toBeNull(); // 火曜 col0
		expect(grid[2][0]).toBeNull(); // 水曜 col0
		// 木曜行（row=3）の先頭が最初のセル
		expect(grid[3][0]).not.toBeNull();
		expect(grid[3][0]?.dateKey).toBe("2026-06-11");
		// 月曜行の第2列（col=1）は 7 日後の月曜なので非 null
		expect(grid[0][1]).not.toBeNull();
	});
});

describe("weakQuestionHref", () => {
	it("単元へ写像できない questionId は /exercises へフォールバックする", () => {
		expect(weakQuestionHref("not-a-question")).toBe("/exercises");
	});

	it("実在 questionId は /{unitId}/{year} になる", () => {
		const unitId = mapQuestionToUnit("exam1-2013-q1");
		expect(weakQuestionHref("exam1-2013-q1")).toBe(`/${unitId}/2013`);
	});
});
