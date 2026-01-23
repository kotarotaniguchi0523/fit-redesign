import type { Question } from "../../types/index";

/**
 * 小テスト7: 符号理論
 * 2013年度版
 */

export const exam7_2013: Question[] = [
	{
		id: "exam7-2013-q1",
		number: 1,
		text: "符号理論に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: true },
			{ label: "エ", value: "", isCorrect: false },
		],
		answer: "ウ",
		explanation: "符号化の基本概念",
	},
	{
		id: "exam7-2013-q2",
		number: 2,
		text: "エントロピーを計算せよ: 1.9 bit/symbol",
		answer: "1.9 bit/symbol",
		explanation: "情報エントロピーの計算問題",
	},
	{
		id: "exam7-2013-q3",
		number: 3,
		text: "符号語を求めよ: C0, 42, DE",
		answer: "C0, 42, DE",
		explanation: "ハフマン符号などの符号化問題",
	},
	{
		id: "exam7-2013-q4",
		number: 4,
		text: "誤り訂正に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: true },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: false },
		],
		answer: "イ",
		explanation: "誤り検出・訂正符号の性質",
	},
	{
		id: "exam7-2013-q5",
		number: 5,
		text: "符号の順序: イ，ウ，ア",
		answer: "イ，ウ，ア",
		explanation: "符号語の辞書式順序など",
	},
];
