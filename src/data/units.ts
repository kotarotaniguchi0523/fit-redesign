import type { Unit, UnitBasedTab } from "../types/index";
import { getSlide } from "./slides";

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
		icon: "🔢",
		description: "2進数・8進数・16進数の変換",
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
		icon: "➖",
		description: "補数を使った負の数の表現",
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
		icon: "📐",
		description: "IEEE 754形式の小数表現",
		slides: [getSlide("slide-2")],
		examMapping: [
			{ year: "2013", examNumbers: [3] },
			// 2014年以降は負数表現と統合されているため、exam2に含まれる
			{ year: "2015", examNumbers: [2], integratedTitle: "負数表現・浮動小数点" },
		],
	},
	{
		id: "unit-logic",
		name: "論理演算",
		title: "単元4: 論理演算",
		icon: "🔀",
		description: "AND/OR/NOT/XORと論理回路",
		slides: [getSlide("slide-3")],
		examMapping: [
			{ year: "2013", examNumbers: [4] },
			{ year: "2014", examNumbers: [4] },
			{ year: "2015", examNumbers: [3, 4], integratedTitle: "集合・論理演算" },
			{ year: "2016", examNumbers: [3], integratedTitle: "集合・論理演算" },
			{ year: "2017", examNumbers: [3], integratedTitle: "集合・論理演算" },
		],
	},
	{
		id: "unit-set-prob",
		name: "集合と確率",
		title: "単元5: 集合と確率",
		icon: "🎲",
		description: "ベン図・確率計算の基礎",
		slides: [getSlide("slide-3"), getSlide("slide-4")],
		examMapping: [
			{ year: "2013", examNumbers: [5, 6] },
			{ year: "2014", examNumbers: [6], integratedTitle: "集合・確率・データ構造" },
			{ year: "2015", examNumbers: [3, 6], integratedTitle: "集合・論理 / 確率" },
			{ year: "2016", examNumbers: [3, 6], integratedTitle: "集合・論理 / FSM" },
			{ year: "2017", examNumbers: [3, 6], integratedTitle: "集合・論理 / FSM・確率・データ構造" },
		],
	},
	{
		id: "unit-automaton",
		name: "オートマトン",
		title: "単元6: オートマトン",
		icon: "⚙️",
		description: "有限状態機械と状態遷移",
		slides: [getSlide("slide-5")],
		examMapping: [
			{ year: "2013", examNumbers: [7] },
			{ year: "2014", examNumbers: [6], integratedTitle: "FSM・確率・データ構造" },
			{ year: "2015", examNumbers: [6], integratedTitle: "FSM・確率" },
			{ year: "2016", examNumbers: [4, 6], integratedTitle: "オートマトン・符号理論" },
			{ year: "2017", examNumbers: [4, 6], integratedTitle: "オートマトン・符号理論" },
		],
	},
	{
		id: "unit-ecc",
		name: "符号理論",
		title: "単元7: 符号理論",
		icon: "✅",
		description: "パリティ・誤り検出訂正",
		slides: [getSlide("slide-6")],
		examMapping: [
			{ year: "2013", examNumbers: [7] },
			{ year: "2014", examNumbers: [7] },
			{ year: "2015", examNumbers: [5, 7] },
			{ year: "2016", examNumbers: [4, 7], integratedTitle: "オートマトン・符号理論" },
			{ year: "2017", examNumbers: [4, 7], integratedTitle: "オートマトン・符号理論" },
		],
	},
	{
		id: "unit-data-structure",
		name: "データ構造",
		title: "単元8: データ構造",
		icon: "📊",
		description: "スタック・キュー・木構造",
		slides: [getSlide("slide-8")],
		examMapping: [
			{ year: "2013", examNumbers: [9] },
			{ year: "2014", examNumbers: [6, 8], integratedTitle: "集合・確率・データ構造" },
			{ year: "2015", examNumbers: [8], integratedTitle: "データ構造" },
			{ year: "2016", examNumbers: [5, 8], integratedTitle: "データ構造・符号理論" },
			{
				year: "2017",
				examNumbers: [5, 6, 8],
				integratedTitle: "データ構造・符号理論 / FSM・確率・データ構造",
			},
		],
	},
	{
		id: "unit-sort",
		name: "ソート・探索",
		title: "単元9: ソート・探索",
		icon: "🔍",
		description: "アルゴリズムと計算量",
		slides: [getSlide("slide-10")],
		examMapping: [
			{ year: "2013", examNumbers: [9], integratedTitle: "データ構造・ソート" },
			{ year: "2014", examNumbers: [9] },
		],
	},
];
