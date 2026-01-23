import type { Question } from "../../types/index";

/**
 * 小テスト6: オートマトン
 * 2013年度版
 */

export const exam6_2013: Question[] = [
	{
		id: "exam6-2013-q1",
		number: 1,
		text: "確率値を計算せよ: 0.977",
		answer: "0.977",
		explanation: "確率計算の問題",
	},
	{
		id: "exam6-2013-q2",
		number: 2,
		text: "オートマトンに関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "", isCorrect: false },
		],
		answer: "エ",
		explanation: "有限オートマトンの基本概念",
	},
	{
		id: "exam6-2013-q3",
		number: 3,
		text: "オートマトンに関する複数選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: true },
			{ label: "ウ", value: "", isCorrect: true },
			{ label: "エ", value: "", isCorrect: false },
		],
		answer: "イ， ウ",
		explanation: "状態遷移に関する問題",
	},
	{
		id: "exam6-2013-q4",
		number: 4,
		text: "オートマトンの状態遷移",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: false },
		],
		answer: "ア",
		explanation: "状態遷移図の読み取り",
	},
	{
		id: "exam6-2013-q5",
		number: 5,
		text: "オートマトンの性質",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: true },
		],
		answer: "エ",
		explanation: "オートマトンの受理条件など",
	},
];
