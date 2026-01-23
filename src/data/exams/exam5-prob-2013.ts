import type { Question } from "../../types/index";

/**
 * 小テスト5: 確率と統計
 * 2013年度版
 */

export const exam5_2013: Question[] = [
	{
		id: "exam5-2013-q1",
		number: 1,
		text: "1ビットのxとyを加算する。和sを表す式はどれか",
		options: [
			{ label: "ア", value: "s = x∧y" },
			{ label: "イ", value: "s = x∨y" },
			{ label: "ウ", value: "s = (x∧y)∨(x̅∧y̅)" },
			{ label: "エ", value: "s = (x̅∧y)∨(x∧y̅)", isCorrect: true },
		],
		answer: "エ",
		explanation: "半加算器の和は排他的論理和（XOR）: s = x⊕y = (x̅∧y)∨(x∧y̅)",
	},
	{
		id: "exam5-2013-q2",
		number: 2,
		text: "白玉4個、赤玉5個入っている壺から球を2個取り出す時、2個とも白である確率を求めよ",
		answer: "1/6",
		explanation: "C(4,2)/C(9,2) = 6/36 = 1/6",
	},
	{
		id: "exam5-2013-q3",
		number: 3,
		text: "男子3人、女子5人から4人を選ぶとき、男子が少なくとも一人以上含まれる選び方は何通りあるか",
		answer: "65",
		explanation: "全体C(8,4) - 男子0人C(5,4) = 70 - 5 = 65通り",
	},
	{
		id: "exam5-2013-q4",
		number: 4,
		text: "事象A「田中が投げた」、事象B「楽天が勝った」とする。Aが生起した時のBの条件付き確率を表す式はどれか",
		options: [
			{ label: "ア", value: "P(A∩B)" },
			{ label: "イ", value: "P(A∪B)" },
			{ label: "ウ", value: "P(A|B)" },
			{ label: "エ", value: "P(B|A)", isCorrect: true },
		],
		answer: "エ",
		explanation: "「Aが生起した時のBの条件付き確率」はP(B|A)と表記する",
	},
	{
		id: "exam5-2013-q5",
		number: 5,
		text: "0と1を組み合わせて出来る長さ1以上7以下の文字列の総数Sを求めよ",
		answer: "254",
		explanation: "2¹ + 2² + 2³ + 2⁴ + 2⁵ + 2⁶ + 2⁷ = 2 + 4 + 8 + 16 + 32 + 64 + 128 = 254",
	},
];
