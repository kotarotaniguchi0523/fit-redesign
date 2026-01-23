import type { Question } from "../../types/index";

/**
 * 小テスト5: 確率と統計
 * 2013年度版
 */

export const exam5_2013: Question[] = [
	{
		id: "exam5-2013-q1",
		number: 1,
		text: "確率に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "", isCorrect: false },
		],
		answer: "エ",
		explanation: "確率の基本概念に関する問題",
	},
	{
		id: "exam5-2013-q2",
		number: 2,
		text: "確率を求めよ: 1/6",
		answer: "1/6",
		explanation: "サイコロやコインなどの基本的な確率問題",
	},
	{
		id: "exam5-2013-q3",
		number: 3,
		text: "期待値を計算せよ: 65",
		answer: "65",
		explanation: "確率分布の期待値計算",
	},
	{
		id: "exam5-2013-q4",
		number: 4,
		text: "統計に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: false },
			{ label: "イ", value: "", isCorrect: false },
			{ label: "ウ", value: "", isCorrect: false },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "", isCorrect: false },
		],
		answer: "エ",
		explanation: "統計の基本概念",
	},
	{
		id: "exam5-2013-q5",
		number: 5,
		text: "組み合わせの数を求めよ: 254",
		answer: "254",
		explanation: "順列・組み合わせの計算問題",
	},
];
