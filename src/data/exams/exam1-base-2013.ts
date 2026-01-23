import type { Question } from "../../types/index";

/**
 * 小テスト1: 基数変換
 * 2013年度版
 * 注: PDFパスはsuffixなし（2013年度）
 */

export const exam1_2013: Question[] = [
	{
		id: "exam1-2013-q1",
		number: 1,
		text: "22を2進数で表せ",
		answer: "22",
		explanation: "10進数22を2進数に変換: 22 = 16 + 4 + 2 = 10110(2)",
	},
	{
		id: "exam1-2013-q2",
		number: 2,
		text: "114.132を8進数で表せ（小数第3位まで）",
		answer: "114.132",
		explanation: "10進数114.132を8進数に変換。整数部: 114 = 162(8), 小数部を計算",
	},
	{
		id: "exam1-2013-q3",
		number: 3,
		text: "53を16進数で表せ",
		answer: "53",
		explanation: "10進数53を16進数に変換: 53 = 3×16 + 5 = 35(16)",
	},
	{
		id: "exam1-2013-q4",
		number: 4,
		text: "0.001111を2進数で表せ",
		answer: "0.001111",
		explanation: "2進小数の表現問題",
	},
	{
		id: "exam1-2013-q5",
		number: 5,
		text: "0.01101を2進数で表せ",
		answer: "0.01101",
		explanation: "2進小数の表現問題",
	},
];
