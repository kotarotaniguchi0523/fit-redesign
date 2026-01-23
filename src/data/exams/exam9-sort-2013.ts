import type { Question } from "../../types/index";

/**
 * 小テスト9: ソート
 * 2013年度版
 */

export const exam9_2013: Question[] = [
	{
		id: "exam9-2013-q1",
		number: 1,
		text: "ソート後の配列: 2,3,6,8",
		answer: "2,3,6,8",
		explanation: "ソートアルゴリズムの実行トレース",
	},
	{
		id: "exam9-2013-q2",
		number: 2,
		text: "ソートアルゴリズムに関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: false },
		],
		answer: "ア",
		explanation: "各種ソートアルゴリズムの特性",
	},
	{
		id: "exam9-2013-q3",
		number: 3,
		text: "比較回数の増加: 3回増える",
		answer: "3回増える",
		explanation: "ソートアルゴリズムの計算量分析",
	},
	{
		id: "exam9-2013-q4",
		number: 4,
		text: "計算量の順序: n log n, n^2, 2^n, n!",
		answer: "n log n, n^2, 2^n, n!",
		explanation: "アルゴリズムの時間計算量の比較",
	},
	{
		id: "exam9-2013-q5",
		number: 5,
		text: "計算結果: 33",
		answer: "33",
		explanation: "ソートに関連する計算問題",
	},
];
