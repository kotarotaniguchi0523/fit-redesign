import type { Question } from "../../types/index";

/**
 * 小テスト2: 負数表現 / 浮動小数点
 * 2015年度版
 */

export const exam2_2015: Question[] = [
	{
		id: "exam2-2015-q1",
		number: 1,
		text: "2の補数表現で値を求める問題",
		answer: "56",
		explanation: "2の補数表現での値を16進数で表す",
	},
	{
		id: "exam2-2015-q2",
		number: 2,
		text: "16進数表現の小数を10進数で表す問題",
		answer: "-5.8125",
		explanation: "符号付き16進数表現を10進数に変換",
	},
	{
		id: "exam2-2015-q3",
		number: 3,
		text: "浮動小数点表現の問題",
		answer: "S=1, M=BA, E=3",
		explanation: "IEEE 754形式などの浮動小数点表現。S=1, M=5D, E=4も正解として認められる",
	},
	{
		id: "exam2-2015-q4",
		number: 4,
		text: "16進数の演算問題",
		answer: "7D",
		explanation: "16進数での演算結果",
	},
	{
		id: "exam2-2015-q5",
		number: 5,
		text: "16進数の演算問題",
		answer: "56",
		explanation: "16進数での演算結果",
	},
];
