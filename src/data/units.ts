import type { TabGroup, TabItem, Unit } from "../types/index";
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
