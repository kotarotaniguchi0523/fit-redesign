import type { Question } from "../../types/index";

/**
 * 小テスト1: 基数変換
 * 2017年度版
 * 注: PDFファイルが不足しているため、解答HTMLから逆算して問題を推定
 */

export const exam1_2017: Question[] = [
	{
		id: "exam1-2017-q1",
		number: 1,
		text: "163.75を2進数で表せ（小数第2位まで）",
		answer: "163.75",
		explanation:
			"10進数の163.75を2進数に変換する。整数部: 163 = 10100011(2), 小数部: 0.75 = 0.11(2)",
	},
	{
		id: "exam1-2017-q2",
		number: 2,
		text: "55を8進数で表せ",
		answer: "55",
		explanation:
			"10進数55を8進数に変換: 55 ÷ 8 = 6 余り 7 → 67(8)。ただし解答は「55」となっているため問題文の確認が必要",
	},
	{
		id: "exam1-2017-q3",
		number: 3,
		text: "468を10進数で表せ",
		answer: "468",
		explanation: "基数変換の問題。元の基数が不明のため、PDFの確認が必要",
	},
	{
		id: "exam1-2017-q4",
		number: 4,
		text: "0.02を2進数で表せ",
		answer: "0.02",
		explanation: "10進数0.02を2進数に変換する。循環小数になる可能性がある",
	},
	{
		id: "exam1-2017-q5",
		number: 5,
		text: "基数変換に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "" },
		],
		answer: "ア，エ",
		explanation: "PDFが不足しているため詳細不明",
	},
];
