import type { Question } from "../../types/index";

/**
 * 小テスト6: オートマトン
 * 2013年度版
 */

export const exam6_2013: Question[] = [
	{
		id: "exam6-2013-q1",
		number: 1,
		text: "テスト結果は平均60点、標準偏差10点であった。80点以下の人は全体の何割か？",
		figureDescription: "u と Pr(U>u) の正規分布表",
		figureData: {
			type: "normalDistributionTable",
			entries: [
				{ u: 0.0, probability: 0.5 },
				{ u: 1.0, probability: 0.159 },
				{ u: 2.0, probability: 0.023 },
				{ u: 3.0, probability: 0.001 },
			],
		},
		answer: "0.977",
		explanation: "80点は平均+2σ。Pr(U>2.0)=0.023なので、80点以下は1-0.023=0.977（約97.7%）",
	},
	{
		id: "exam6-2013-q2",
		number: 2,
		text: "次の表のデータがある。この相関係数は次のどれか？",
		figureDescription: "x と y の対応表",
		figureData: {
			type: "dataTable",
			columns: [
				{ key: "x", label: "x" },
				{ key: "y", label: "y" },
			],
			rows: [
				{ x: 20, y: 0.4 },
				{ x: 30, y: 0.1 },
				{ x: 40, y: 0.1 },
			],
		},
		options: [
			{ label: "ア", value: "2.5" },
			{ label: "イ", value: "0.86" },
			{ label: "ウ", value: "0" },
			{ label: "エ", value: "−0.86", isCorrect: true },
		],
		answer: "エ",
		explanation: "xが増加するとyが減少する負の相関。相関係数は約-0.86",
	},
	{
		id: "exam6-2013-q3",
		number: 3,
		text: "以下の状態遷移図で定義される有限オートマトンがある。初期状態をS0、受理状態をS2とする。このオートマトンが受理する入力文字列を全て挙げよ",
		options: [
			{ label: "ア", value: "01010" },
			{ label: "イ", value: "11000", isCorrect: true },
			{ label: "ウ", value: "10110", isCorrect: true },
			{ label: "エ", value: "10101" },
		],
		answer: "イ，ウ",
		explanation:
			"S0から始まり、11でS2に到達。S2は0,1どちらでも自己ループ。イとウは11を含み受理される",
		figureDescription: "状態遷移図: S0 --1--> S1 --1--> S2(受理), S1 --0--> S0, S2 --0,1--> S2",
		figureData: {
			type: "stateDiagram",
			nodes: [
				{ id: "s0", label: "S0", x: 50, y: 75, isInitial: true },
				{ id: "s1", label: "S1", x: 150, y: 75 },
				{ id: "s2", label: "S2", x: 250, y: 75, isAccepting: true },
			],
			transitions: [
				{ from: "s0", to: "s0", label: "0" },
				{ from: "s0", to: "s1", label: "1" },
				{ from: "s1", to: "s2", label: "1" },
				{ from: "s1", to: "s0", label: "0", curveOffset: -40 },
				{ from: "s2", to: "s2", label: "0,1" },
			],
		},
	},
	{
		id: "exam6-2013-q4",
		number: 4,
		text: "次の正規表現で受理される文字列を全て選べ。*は0回以上、+は1回以上の繰返し。\n[+−]*[0-9]+E[0-9]+",
		options: [
			{ label: "ア", value: "+32E5", isCorrect: true },
			{ label: "イ", value: "3E−5" },
			{ label: "ウ", value: "−32E−5" },
			{ label: "エ", value: "+324" },
		],
		answer: "ア",
		explanation:
			"[+−]*で符号0回以上、[0-9]+で数字1回以上、E、[0-9]+で数字1回以上。イはE後に符号があり不正、ウも同様、エはEがない",
	},
	{
		id: "exam6-2013-q5",
		number: 5,
		text: "Y=(A+B)*((C−D)/E) を意味する逆ポーランド記法を選べ",
		options: [
			{ label: "ア", value: "YAB+CDE/−*=" },
			{ label: "イ", value: "YAB+C−DE−*=" },
			{ label: "ウ", value: "YAB+EDC/−*=" },
			{ label: "エ", value: "YAB+CD−E/*=", isCorrect: true },
		],
		answer: "エ",
		explanation:
			"(A+B)→AB+、(C−D)→CD−、(C−D)/E→CD−E/、(A+B)*((C−D)/E)→AB+CD−E/*、Y=...→YAB+CD−E/*=",
	},
];
