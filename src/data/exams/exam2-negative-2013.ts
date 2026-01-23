import type { Question } from "../../types/index";

/**
 * 小テスト2: 負数表現
 * 2013年度版
 */

export const exam2_2013: Question[] = [
	{
		id: "exam2-2013-q1",
		number: 1,
		text: "2の補数表現で176を表せ（8bit）",
		answer: "176",
		explanation: "8ビットでの2の補数表現の問題",
	},
	{
		id: "exam2-2013-q2",
		number: 2,
		text: "2の補数でFFFFを10進数で表せ",
		answer: "FFFF",
		explanation: "16進数FFFFを2の補数として解釈し10進数に変換",
	},
	{
		id: "exam2-2013-q3",
		number: 3,
		text: "16進数80を2の補数として解釈した値",
		answer: "80",
		explanation: "16進数80を符号付き整数として解釈",
	},
	{
		id: "exam2-2013-q4",
		number: 4,
		text: "A.Aを16進小数で表現",
		answer: "A.A",
		explanation: "16進小数表現の問題",
	},
	{
		id: "exam2-2013-q5",
		number: 5,
		text: "-5.6875を浮動小数点で表せ",
		answer: "-5.6875",
		explanation: "負の小数を浮動小数点形式で表現",
	},
];
