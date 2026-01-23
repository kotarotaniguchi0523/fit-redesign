import type { Question } from "../../types/index";

/**
 * 小テスト4: 集合と論理
 * 2013年度版
 */

export const exam4_2013: Question[] = [
	{
		id: "exam4-2013-q1",
		number: 1,
		text: "論理演算でC2を計算せよ",
		answer: "C2",
		explanation: "16進数での論理演算",
	},
	{
		id: "exam4-2013-q2",
		number: 2,
		text: "z=xy + ~x~y を簡略化せよ",
		answer: "z=xy + ~x~y",
		explanation: "論理式の簡略化問題",
	},
	{
		id: "exam4-2013-q3",
		number: 3,
		text: "x~y + ~xy を簡略化せよ",
		answer: "x~y + ~xy",
		explanation: "排他的論理和（XOR）の論理式",
	},
	{
		id: "exam4-2013-q4",
		number: 4,
		text: "真理値表を完成させよ: 0,0,1,1",
		answer: "0,0,1,1",
		explanation: "論理演算の真理値表",
	},
	{
		id: "exam4-2013-q5",
		number: 5,
		text: "集合Uを求めよ",
		answer: "U",
		explanation: "集合演算の問題",
	},
];
