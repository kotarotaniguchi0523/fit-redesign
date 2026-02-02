import type { Question } from "../../types/index";

/**
 * 小テスト6: FSM（有限オートマトン）
 * 2015年度版
 * 注: PDFファイル（Exam6c-FSM.pdf）から問題文を取得。解答はExam2015-Ans.htmlを参照
 */

export const exam6_2015: Question[] = [
	{
		id: "exam6-2015-q1",
		number: 1,
		text: "男4人、女5人から4人を選ぶとき、男子少なくとも1人以上含まれる確率Pを求めよ",
		answer: "121/126",
		explanation:
			"全体の選び方は9C4=126通り。女子のみ4人選ぶ場合は5C4=5通り。したがって男子が少なくとも1人含まれる確率は (126-5)/126 = 121/126",
	},
	{
		id: "exam6-2015-q2",
		number: 2,
		text: "平均5.2kg、標準偏差0.1kgの正規分布で製造されている製品があり、5.4kg以上の製品が0.023の確率で発生していた。ある製品が5.0kg以上になる確率Pはいくらか？",
		answer: "0.977",
		explanation:
			"5.4kgは平均から+2σ（標準偏差2個分）の位置で確率0.023。正規分布は左右対称なので、5.0kg（平均から-2σ）以上の確率は 1-0.023 = 0.977",
	},
	{
		id: "exam6-2015-q3",
		number: 3,
		text: "以下の状態遷移図は、奇数個のビットを受理するオートマトンである。下線を埋めよ。\n初期状態: S0\n偏数状態: ウ\n0と1の遷移があり、S0からS1へ、S1から自己ループと戻りがある",
		figureData: {
			type: "stateDiagram",
			nodes: [
				{ id: "s0", label: "S0", x: 100, y: 75, isInitial: true },
				{ id: "s1", label: "S1", x: 300, y: 75, isAccepting: true },
			],
			transitions: [
				{ from: "s0", to: "s0", label: "0" },
				{ from: "s0", to: "s1", label: "ア" },
				{ from: "s1", to: "s1", label: "1" },
				{ from: "s1", to: "s0", label: "イ", curveOffset: 50 },
			],
		},
		answer: "ア 1, イ 0, ウ S0",
		explanation:
			"奇数個のビットを受理するには、S0(偶数状態)とS1(奇数状態)を交互に遷移する。ア=1でS1へ、イ=0でS0へ戻る。偶数状態はウ=S0",
	},
	{
		id: "exam6-2015-q4",
		number: 4,
		text: "次のBNF記法で定義される<3進数>として、扱われるものを全て選べ（複数選択可能）\n<数> ::= 0|1|2\n<3進数> ::= <数> | <数><3進数> | <3進数>.<3進数>",
		options: [
			{ label: "ア", value: "120", isCorrect: true },
			{ label: "イ", value: "-220" },
			{ label: "ウ", value: "12.3", isCorrect: true },
			{ label: "エ", value: ".001" },
		],
		answer: "ア",
		explanation:
			"BNF定義により、<3進数>は0,1,2の数字の組み合わせ、またはドットで区切られた3進数。ア(120)は<数><3進数>で生成可能。イは負号があり不可。ウ(12.3)は<3進数>.<3進数>で生成可能。エは先頭がドットで不可",
	},
	{
		id: "exam6-2015-q5",
		number: 5,
		text: "逆ポーランド表記法で AB-BCD/+* と表現される式を中置記法（通常の式）に変換せよ",
		answer: "(A-B)*(B+(C/D))",
		explanation:
			"逆ポーランド記法を左から処理: AB-→(A-B)、CD/→(C/D)、BCD/+→B+(C/D)、最後に*で結合→(A-B)*(B+(C/D))",
	},
];
