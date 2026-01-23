import type { Question } from "../../types/index";

/**
 * 小テスト6: FSM（有限オートマトン）/ 確率・データ構造
 * 2017年度版（Exam6e-FSM.pdf）
 * 注: このPDFには確率、BNF、スタック（逆ポーランド記法）の問題が含まれている
 */

export const exam6_2017: Question[] = [
	{
		id: "exam6-2017-q0",
		number: 0,
		text: "以下の状態遷移図で定義される有限オートマトンが受理する入力文字列を全て挙げよ",
		hasFigure: true,
		figureDescription: "状態遷移図: S0(初期状態) --1--> S1 --1--> S2(受理状態)",
		figureData: {
			type: "stateDiagram",
			nodes: [
				{ id: "s0", label: "S0", x: 50, y: 75, isInitial: true },
				{ id: "s1", label: "S1", x: 150, y: 75 },
				{ id: "s2", label: "S2", x: 250, y: 75, isAccepting: true },
			],
			transitions: [
				{ from: "s0", to: "s1", label: "1" },
				{ from: "s1", to: "s2", label: "1" },
				{ from: "s1", to: "s0", label: "0", curveOffset: -30 },
				{ from: "s2", to: "s2", label: "0,1" },
			],
		},
		options: [
			{ label: "ア", value: "01010" },
			{ label: "イ", value: "11000", isCorrect: true },
			{ label: "ウ", value: "10110", isCorrect: true },
			{ label: "エ", value: "10101" },
		],
		answer: "イ, ウ",
		explanation:
			"S0から始まり、'11'でS2（受理状態）に到達し、以降は任意の文字列を受理する。イ(11000)とウ(10110)は'11'を含み受理される。",
	},
	{
		id: "exam6-2017-q1",
		number: 1,
		text: "事象 A「1回目に赤玉が出る」，事象 B「2回目に赤玉が出る」とするとき，事象 A が生起した時の B の条件付確率を表す記号はどれか？",
		options: [
			{ label: "ア", value: "P(A∩B)" },
			{ label: "イ", value: "P(A∪B)" },
			{ label: "ウ", value: "P(A|B)" },
			{ label: "エ", value: "P(B|A)", isCorrect: true },
			{ label: "オ", value: "P(B)" },
		],
		answer: "エ",
		explanation: "P(B|A) は「Aが起きたときのBの条件付確率」を表す",
	},
	{
		id: "exam6-2017-q2",
		number: 2,
		text: "白玉5個，赤玉4個が入っている壺から球を2個取り出す．赤玉の数の期待値を求めよ．",
		answer: "8/9",
		explanation: "期待値 E[X] = 0×P(X=0) + 1×P(X=1) + 2×P(X=2) を計算する",
	},
	{
		id: "exam6-2017-q3",
		number: 3,
		text: "平均60点のテストで55点と採点された時の偏差値が40点だった．この時の標準偏差を求めよ．",
		answer: "5",
		explanation: "偏差値 = 50 + 10×(得点-平均)/標準偏差。40 = 50 + 10×(55-60)/σ より σ = 5",
	},
	{
		id: "exam6-2017-q4",
		number: 4,
		text: "次のBNFで定義されるビット列を全て挙げよ．\n<S>::=0|1|<S>0",
		options: [
			{ label: "ア", value: "00", isCorrect: true },
			{ label: "イ", value: "01" },
			{ label: "ウ", value: "10", isCorrect: true },
			{ label: "エ", value: "010" },
			{ label: "オ", value: "100", isCorrect: true },
		],
		answer: "ア，ウ，オ",
		explanation:
			"BNFにより生成できるのは、0で終わるビット列（0, 10, 00, 100, 110, 1000, ...）と1のみ",
	},
	{
		id: "exam6-2017-q5",
		number: 5,
		text: "A=1, B=3, C=5, D=4 の時，逆ポーランド表記された式 AB+CD-* の演算結果を求めよ．",
		answer: "4",
		explanation: "AB+ = 1+3 = 4, CD- = 5-4 = 1, 4*1 = 4",
	},
];
