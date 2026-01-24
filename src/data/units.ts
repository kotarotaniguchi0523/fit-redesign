import type { TabGroup, TabItem, Unit, UnitBasedTab, Year } from "../types/index";
import { exam1, exam2, exam3, exam4, exam5, exam6, exam7, exam8, exam9 } from "./exams";
import { getSlide } from "./slides";

// 2013年度用の単元（9つの小テスト対応）
export const units2013: Unit[] = [
	{
		id: "unit-1",
		number: 1,
		name: "基数変換",
		slides: [getSlide("slide-1")],
		exams: exam1,
		is2013Only: true,
	},
	{
		id: "unit-2",
		number: 2,
		name: "負数表現",
		slides: [getSlide("slide-2")],
		exams: exam2,
		is2013Only: true,
	},
	{
		id: "unit-3",
		number: 3,
		name: "浮動小数点",
		slides: [getSlide("slide-2")],
		exams: exam3,
		is2013Only: true,
	},
	{
		id: "unit-4",
		number: 4,
		name: "論理演算",
		slides: [getSlide("slide-3")],
		exams: exam4,
		is2013Only: true,
	},
	{
		id: "unit-5",
		number: 5,
		name: "集合",
		slides: [getSlide("slide-3")],
		exams: exam5,
		is2013Only: true,
	},
	{
		id: "unit-6",
		number: 6,
		name: "確率",
		slides: [getSlide("slide-4")],
		exams: exam6,
		is2013Only: true,
	},
	{
		id: "unit-7",
		number: 7,
		name: "オートマトン",
		slides: [getSlide("slide-5")],
		exams: exam7,
		is2013Only: true,
	},
	{
		id: "unit-8",
		number: 8,
		name: "符号理論",
		slides: [getSlide("slide-6")],
		exams: exam8,
		is2013Only: true,
	},
	{
		id: "unit-9",
		number: 9,
		name: "データ構造",
		slides: [getSlide("slide-8")],
		exams: exam9,
		is2013Only: true,
	},
];

// 2014年度以降用のタブグループ（5つの統合小テスト）
export const tabGroups2014: TabGroup[] = [
	{
		id: "tab-1",
		name: "基数変換 + 負数表現",
		units: [
			{
				id: "unit-2014-1a",
				number: 1,
				name: "基数変換",
				slides: [getSlide("slide-1")],
			},
			{
				id: "unit-2014-1b",
				number: 2,
				name: "負数表現",
				slides: [getSlide("slide-2")],
			},
		],
		examNumber: 1,
		title: "小テスト1: 基数変換 + 負数表現",
	},
	{
		id: "tab-2",
		name: "浮動小数点 + 論理演算",
		units: [
			{
				id: "unit-2014-2a",
				number: 3,
				name: "浮動小数点",
				slides: [getSlide("slide-2")],
			},
			{
				id: "unit-2014-2b",
				number: 4,
				name: "論理演算",
				slides: [getSlide("slide-3")],
			},
		],
		examNumber: 2,
		title: "小テスト2: 浮動小数点 + 論理演算",
	},
	{
		id: "tab-3",
		name: "集合 + 確率",
		units: [
			{
				id: "unit-2014-3a",
				number: 5,
				name: "集合",
				slides: [getSlide("slide-3")],
			},
			{
				id: "unit-2014-3b",
				number: 6,
				name: "確率",
				slides: [getSlide("slide-4")],
			},
		],
		examNumber: 3,
		title: "小テスト3: 集合 + 確率",
	},
	{
		id: "tab-4",
		name: "オートマトン + 符号理論",
		units: [
			{
				id: "unit-2014-4a",
				number: 7,
				name: "オートマトン",
				slides: [getSlide("slide-5")],
			},
			{
				id: "unit-2014-4b",
				number: 8,
				name: "符号理論",
				slides: [getSlide("slide-6")],
			},
		],
		examNumber: 4,
		title: "小テスト4: オートマトン + 符号理論",
	},
	{
		id: "tab-5",
		name: "データ構造 + ソート",
		units: [
			{
				id: "unit-2014-5a",
				number: 9,
				name: "データ構造",
				slides: [getSlide("slide-8")],
			},
			{
				id: "unit-2014-5b",
				number: 10,
				name: "ソート",
				slides: [getSlide("slide-10")],
			},
		],
		examNumber: 5,
		title: "小テスト5: データ構造 + ソート",
	},
];

// 講義資料のみの単元
export const slideOnlyUnits: Unit[] = [
	{
		id: "slide-only-0",
		number: 0,
		name: "ガイダンス",
		slides: [getSlide("slide-0")],
	},
	{
		id: "slide-only-7",
		number: 7,
		name: "制御理論",
		slides: [getSlide("slide-7")],
	},
	{
		id: "slide-only-9",
		number: 9,
		name: "2分検索木",
		slides: [getSlide("slide-9")],
	},
	{
		id: "slide-only-11",
		number: 11,
		name: "計算量",
		slides: [getSlide("slide-11")],
	},
	{
		id: "slide-only-12",
		number: 12,
		name: "プログラミング言語",
		slides: [getSlide("slide-12")],
	},
];

// ===== 変換関数 =====

/**
 * Unit から TabItem への変換
 */
function unitToTabItem(unit: Unit): TabItem {
	return {
		id: unit.id,
		name: unit.name,
		title: `小テスト: ${unit.name}`,
		slides: unit.slides,
		examNumber: unit.exams?.examNumber,
	};
}

/**
 * TabGroup から TabItem への変換
 */
function tabGroupToTabItem(group: TabGroup): TabItem {
	return {
		id: group.id,
		name: group.name,
		title: group.title,
		slides: group.units.flatMap((u) => u.slides),
		examNumber: group.examNumber,
	};
}

// ===== 統一されたタブアイテム（UI用） =====

export const tabs2013: TabItem[] = units2013.map(unitToTabItem);
export const tabs2014: TabItem[] = tabGroups2014.map(tabGroupToTabItem);

// ===== 単元ベースのタブ構造 =====

/**
 * 単元ベースのタブ定義
 * トップレベルが単元、各単元内で年度を選択する構造
 *
 * マッピングルール:
 * - 2013年: 9単元それぞれ独立 (exam1-9)
 * - 2014年以降: 統合試験
 *   - 基数変換+負数表現 → exam1, exam2
 *   - 浮動小数点+論理演算 → exam3, exam4
 *   - 集合+確率 → exam5, exam6
 *   - オートマトン+符号理論 → exam6, exam7 (2016-2017はexam4)
 *   - データ構造+ソート → exam8, exam9 (2016-2017はexam5)
 */
export const unitBasedTabs: UnitBasedTab[] = [
	{
		id: "unit-base-conversion",
		name: "基数変換",
		title: "単元1: 基数変換",
		slides: [getSlide("slide-1")],
		examMapping: [
			{ year: "2013", examNumbers: [1] },
			{ year: "2014", examNumbers: [1] },
			{ year: "2015", examNumbers: [1] },
			{ year: "2016", examNumbers: [1] },
			{ year: "2017", examNumbers: [1] },
		],
	},
	{
		id: "unit-negative",
		name: "負数表現",
		title: "単元2: 負数表現",
		slides: [getSlide("slide-2")],
		examMapping: [
			{ year: "2013", examNumbers: [2] },
			{ year: "2014", examNumbers: [2] },
			{ year: "2015", examNumbers: [2] },
			{ year: "2016", examNumbers: [2] },
			{ year: "2017", examNumbers: [2] },
		],
	},
	{
		id: "unit-float",
		name: "浮動小数点",
		title: "単元3: 浮動小数点",
		slides: [getSlide("slide-2")],
		examMapping: [
			{ year: "2013", examNumbers: [3] },
			// 2014年以降は負数表現と統合されているため、exam2に含まれる
			{ year: "2015", examNumbers: [2] }, // 2015年は負数表現・浮動小数点として統合
		],
	},
	{
		id: "unit-logic",
		name: "論理演算",
		title: "単元4: 論理演算",
		slides: [getSlide("slide-3")],
		examMapping: [
			{ year: "2013", examNumbers: [4] },
			{ year: "2014", examNumbers: [4] },
			{ year: "2015", examNumbers: [3, 4] }, // 集合・論理演算として分散
		],
	},
	{
		id: "unit-set-prob",
		name: "集合と確率",
		title: "単元5: 集合と確率",
		slides: [getSlide("slide-3"), getSlide("slide-4")],
		examMapping: [
			{ year: "2013", examNumbers: [5, 6] }, // 集合(exam5), 確率(exam6)
			{ year: "2014", examNumbers: [6] }, // 集合・確率・データ構造として統合
			{ year: "2015", examNumbers: [3, 6] }, // 集合・論理(exam3), 確率(exam6)
		],
	},
	{
		id: "unit-automaton",
		name: "オートマトン",
		title: "単元6: オートマトン",
		slides: [getSlide("slide-5")],
		examMapping: [
			{ year: "2013", examNumbers: [7] },
			{ year: "2014", examNumbers: [6] },
			{ year: "2015", examNumbers: [6] }, // FSM・確率として統合
			{ year: "2016", examNumbers: [4, 6] }, // オートマトン・符号理論(exam4), FSM(exam6)
			{ year: "2017", examNumbers: [4, 6] },
		],
	},
	{
		id: "unit-ecc",
		name: "符号理論",
		title: "単元7: 符号理論",
		slides: [getSlide("slide-6")],
		examMapping: [
			{ year: "2013", examNumbers: [8] },
			{ year: "2014", examNumbers: [7] },
			{ year: "2015", examNumbers: [5, 7] }, // 符号理論(exam5, exam7)
			{ year: "2016", examNumbers: [4, 7] }, // オートマトン・符号理論(exam4), 符号理論(exam7)
			{ year: "2017", examNumbers: [4, 7] },
		],
	},
	{
		id: "unit-data-structure",
		name: "データ構造",
		title: "単元8: データ構造",
		slides: [getSlide("slide-8")],
		examMapping: [
			{ year: "2013", examNumbers: [9] },
			{ year: "2014", examNumbers: [6, 8] }, // 集合・確率・データ構造(exam6), データ構造(exam8)
			{ year: "2016", examNumbers: [5, 8] }, // データ構造・符号理論(exam5), データ構造(exam8)
			{ year: "2017", examNumbers: [5, 6, 8] }, // データ構造・符号理論(exam5), FSM・確率・データ構造(exam6), データ構造(exam8)
		],
	},
	{
		id: "unit-sort",
		name: "ソート・探索",
		title: "単元9: ソート・探索",
		slides: [getSlide("slide-10")],
		examMapping: [
			{ year: "2013", examNumbers: [9] }, // 2013年はデータ構造に含まれる
			{ year: "2014", examNumbers: [9] }, // ソート・探索として独立
		],
	},
];

// ===== ヘルパー関数 =====

/**
 * 単元IDから単元を取得
 */
export function getUnitBasedTab(unitId: string): UnitBasedTab | undefined {
	return unitBasedTabs.find((unit) => unit.id === unitId);
}

/**
 * 指定した年度で利用可能な単元一覧を取得
 */
export function getAvailableUnitsForYear(year: Year): UnitBasedTab[] {
	return unitBasedTabs.filter((unit) => unit.examMapping.some((mapping) => mapping.year === year));
}

/**
 * 単元と年度から対応する試験番号を取得
 */
export function getExamNumbersForUnit(unitId: string, year: Year): number[] {
	const unit = getUnitBasedTab(unitId);
	if (!unit) return [];

	const mapping = unit.examMapping.find((m) => m.year === year);
	return mapping?.examNumbers ?? [];
}
