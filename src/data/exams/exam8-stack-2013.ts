import type { Question } from "../../types/index";

/**
 * 小テスト8: データ構造
 * 2013年度版
 */

export const exam8_2013: Question[] = [
	{
		id: "exam8-2013-q1",
		number: 1,
		text: "スタック操作の結果: A",
		answer: "A",
		explanation: "スタックのpush/pop操作のトレース",
	},
	{
		id: "exam8-2013-q2",
		number: 2,
		text: "データ構造に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: true },
		],
		answer: "エ",
		explanation: "スタック、キュー、木などのデータ構造の性質",
	},
	{
		id: "exam8-2013-q3",
		number: 3,
		text: "データ構造の操作回数: 5",
		answer: "5",
		explanation: "操作のステップ数を数える問題",
	},
	{
		id: "exam8-2013-q4",
		number: 4,
		text: "木の高さまたはノード数: 6",
		answer: "6",
		explanation: "二分木などの性質",
	},
	{
		id: "exam8-2013-q5",
		number: 5,
		text: "計算結果: 50",
		answer: "50",
		explanation: "データ構造を用いた計算問題",
	},
];
