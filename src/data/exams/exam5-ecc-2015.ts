import type { Question } from "../../types/index";

/**
 * 小テスト5: 符号理論（Error Correcting Code）
 * 2015年度版（Exam5c-ECC.pdf）
 */

export const exam5_2015: Question[] = [
	{
		id: "exam5-2015-q1",
		number: 1,
		text: "平均符号長を求めよ。単位を明記せよ。",
		answer: "1.75 ビット/シンボル",
		explanation:
			"各文字の生起確率と符号長から平均符号長を計算する。平均符号長 = Σ(生起確率 × 符号長)",
	},
	{
		id: "exam5-2015-q2",
		number: 2,
		text: "符号理論に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ア",
		explanation: "符号の性質（瞬時符号、一意復号可能性など）に関する問題",
	},
	{
		id: "exam5-2015-q3",
		number: 3,
		text: "パリティ検査符号に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ア",
		explanation: "パリティビットを用いた誤り検出・訂正符号の性質",
	},
	{
		id: "exam5-2015-q4",
		number: 4,
		text: "誤り訂正符号の能力に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "" },
		],
		answer: "エ",
		explanation: "ハミング距離と誤り検出・訂正能力の関係に関する問題",
	},
	{
		id: "exam5-2015-q5",
		number: 5,
		text: "符号化方式に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "", isCorrect: true },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ウ",
		explanation: "CRC符号、ハミング符号などの符号化方式の特徴や用途",
	},
];
