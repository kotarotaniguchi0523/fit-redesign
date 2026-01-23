import type { Question } from "../../types/index";

/**
 * 小テスト1: 基数変換
 * 2015年度版
 */

export const exam1_2015: Question[] = [
	{
		id: "exam1-2015-q1",
		number: 1,
		text: "165.75を2進数で表せ",
		answer: "165.75",
		explanation:
			"10進数の165.75を2進数に変換する。整数部: 165 = 10100101(2), 小数部: 0.75 = 0.11(2) → 10100101.11(2)",
	},
	{
		id: "exam1-2015-q2",
		number: 2,
		text: "0EE.E4を10進数で表せ（16進数から変換）",
		answer: "0EE.E4",
		explanation:
			"16進数0EE.E4を10進数に変換: 0×256 + 14×16 + 14×1 + 14/16 + 4/256 = 0 + 224 + 14 + 0.875 + 0.015625 = 238.890625",
	},
	{
		id: "exam1-2015-q3",
		number: 3,
		text: "173.64を10進数で表せ（8進数から変換）",
		answer: "173.64",
		explanation:
			"8進数173.64を10進数に変換: 1×64 + 7×8 + 3×1 + 6/8 + 4/64 = 64 + 56 + 3 + 0.75 + 0.0625 = 123.8125",
	},
	{
		id: "exam1-2015-q4",
		number: 4,
		text: "2進数0.00101を分数で表せ",
		answer: "5/32",
		explanation:
			"2進数0.00101 = 0×1/2 + 0×1/4 + 1×1/8 + 0×1/16 + 1×1/32 = 1/8 + 1/32 = 4/32 + 1/32 = 5/32",
	},
	{
		id: "exam1-2015-q5",
		number: 5,
		text: "基数変換に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "", isCorrect: true },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "イ",
		explanation: "基数変換の性質に関する問題。PDFの確認が必要",
	},
];
