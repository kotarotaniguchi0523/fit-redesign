import type { Question } from "../../types/index";

/**
 * 小テスト2: 負数表現
 * 2016年度版
 * 注: PDFファイル（Exam2d-Negative.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam2_2016: Question[] = [
	{
		id: "exam2-2016-q1",
		number: 1,
		text: "16進数で表された値を求める問題",
		answer: "1D",
		explanation: "2の補数表現または符号付き16進数の問題",
	},
	{
		id: "exam2-2016-q2",
		number: 2,
		text: "16進数で表された値を求める問題",
		answer: "D4",
		explanation: "負数の2の補数表現を16進数で表す",
	},
	{
		id: "exam2-2016-q3",
		number: 3,
		text: "16進数で表された値を求める問題",
		answer: "F5",
		explanation: "2の補数表現の計算問題",
	},
	{
		id: "exam2-2016-q4",
		number: 4,
		text: "16進数で表された値を求める問題",
		answer: "98",
		explanation: "符号付き数値の16進数表現",
	},
	{
		id: "exam2-2016-q5",
		number: 5,
		text: "浮動小数点表現の問題",
		answer: "8.F8",
		explanation: "IEEE 754形式などの浮動小数点数の16進数表現",
	},
];
