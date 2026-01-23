import type { Question } from "../../types/index";

/**
 * 小テスト7: 符号理論（Error Correcting Code）
 * 2017年度版（Exam7e-ECC.pdf）
 */

export const exam7_2017: Question[] = [
	{
		id: "exam7-2017-q1",
		number: 1,
		text: "4種類の文字を固定長で符号化するには2ビット必要である．n種類の文字を固定長で符号化する時のビット数を表せ．",
		options: [
			{ label: "ア", value: "n/2" },
			{ label: "イ", value: "n - 2" },
			{ label: "ウ", value: "log₂ n", isCorrect: true },
			{ label: "エ", value: "n log₂ n" },
			{ label: "オ", value: "logₑ n" },
		],
		answer: "ウ",
		explanation: "n種類の文字を区別するには log₂ n ビット必要（情報量の基本公式）",
	},
	{
		id: "exam7-2017-q2",
		number: 2,
		text: "文字 A, B, C が 0, 10, 1100 と符号化されている．それぞれの生起確率を 0.5, 0.4, 0.1 とする時，平均符号長を求めよ．単位を明記せよ．",
		answer: "1.7 ビット/シンボル",
		explanation: "平均符号長 = 0.5×1 + 0.4×2 + 0.1×4 = 0.5 + 0.8 + 0.4 = 1.7 ビット/シンボル",
	},
	{
		id: "exam7-2017-q3",
		number: 3,
		text: "レジスタ d₀, d₁, パリティビット p がある．偶数パリティで常に成立する式を全て選べ．",
		options: [
			{ label: "ア", value: "d₀ ⊕ d₁ = p", isCorrect: true },
			{ label: "イ", value: "d₀ ⊕ d₁ ⊕ 0 = p", isCorrect: true },
			{ label: "ウ", value: "d₀ ⊕ d₁ ⊕ p = 0", isCorrect: true },
			{ label: "エ", value: "d₀ ⊕ d₁ ⊕ p = 1" },
		],
		answer: "ア，イ，ウ",
		explanation: "偶数パリティでは d₀ ⊕ d₁ ⊕ p = 0 が成立する。これと同値な式がア、イ、ウ",
	},
	{
		id: "exam7-2017-q4",
		number: 4,
		text: "水平垂直パリティ検査符号 w=(x₁,x₂,x₃,x₄,c₁,c₂,c₃,c₄,c₅)がある．\n受信語 y =(0, 1, 1, 0, 1, 1, 1, 1, 1)に誤りがあるか？あれば訂正した符号語を示せ．",
		answer: "(0,1,1,0, 1,1,1,1,0)",
		explanation: "水平垂直パリティチェックにより誤り位置を特定し、訂正する",
		hasFigure: true,
		figureDescription: "水平垂直パリティ検査符号の構造図",
		figureData: {
			type: "parityCheck",
			data: [
				[0, 1],
				[1, 0],
			],
		},
	},
	{
		id: "exam7-2017-q5",
		number: 5,
		text: "CRC符号で実現可能な機能を次の選択肢から全て挙げよ．",
		options: [
			{ label: "ア", value: "単一誤り検出", isCorrect: true },
			{ label: "イ", value: "単一誤り訂正" },
			{ label: "ウ", value: "二重誤り検出", isCorrect: true },
			{ label: "エ", value: "二重誤り訂正" },
		],
		answer: "ア，ウ",
		explanation:
			"CRC符号は誤り検出のみ可能で、誤り訂正はできない。適切な生成多項式により二重誤り検出も可能",
	},
];
