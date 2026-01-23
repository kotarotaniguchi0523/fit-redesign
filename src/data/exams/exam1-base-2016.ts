import type { Question } from "../../types/index";

/**
 * 小テスト1: 基数変換
 * 2016年度版
 * 注: PDFファイル（Exam1d-Base.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam1_2016: Question[] = [
	{
		id: "exam1-2016-q1",
		number: 1,
		text: "60.4375を2進数で表せ",
		answer: "60.4375",
		explanation:
			"10進数60.4375を2進数に変換。整数部: 60 = 111100(2), 小数部: 0.4375 = 0.0111(2) → 111100.0111(2)",
	},
	{
		id: "exam1-2016-q2",
		number: 2,
		text: "4146を8進数で表せ",
		answer: "4146",
		explanation: "10進数4146を8進数に変換: 4146 ÷ 8 を繰り返すことで求める",
	},
	{
		id: "exam1-2016-q3",
		number: 3,
		text: "468を10進数で表せ",
		answer: "468",
		explanation: "他の基数から10進数への変換問題。元の基数はPDFで確認",
	},
	{
		id: "exam1-2016-q4",
		number: 4,
		text: "0.304を2進数で表せ",
		answer: "0.304",
		explanation: "10進数0.304を2進数に変換。小数部の2進変換を行う",
	},
	{
		id: "exam1-2016-q5",
		number: 5,
		text: "71を16進数で表せ",
		answer: "71",
		explanation: "10進数71を16進数に変換: 71 = 4×16 + 7 = 47(16)",
	},
];
