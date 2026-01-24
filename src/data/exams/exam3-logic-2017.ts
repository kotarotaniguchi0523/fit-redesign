import type { Question } from "../../types/index";

/**
 * 小テスト3: 集合・論理演算
 * 2017年度版
 * PDFファイル: Exam4e-logic.pdf
 */

export const exam3_2017: Question[] = [
	{
		id: "exam3-2017-q1",
		number: 1,
		text: "X={0,1}とする。2^X–X を求めよ。",
		answer: "{φ, {0}, {1}}",
		explanation:
			"2^X は集合Xのべき集合（すべての部分集合の集合）。\nX = {0, 1} なので、2^X = {φ, {0}, {1}, {0,1}}\n\n2^X – X は「べき集合からXの要素を除いた集合」ではなく、「べき集合からXそのものを除いた集合」。\nX = {0, 1} を 2^X から除くと:\n2^X – X = {φ, {0}, {1}, {0,1}} – {0,1} = {φ, {0}, {1}}\n\n答え: {φ, {0}, {1}}",
	},
	{
		id: "exam3-2017-q2",
		number: 2,
		text: "論理式 AB~C∨ABC∨~AB~C∨~ABC と恒等な式を選べ。\nア AB∨BC\nイ B\nウ ABC\nエ B~C∨AC",
		options: [
			{ label: "ア", value: "AB∨BC" },
			{ label: "イ", value: "B", isCorrect: true },
			{ label: "ウ", value: "ABC" },
			{ label: "エ", value: "B~C∨AC" },
		],
		answer: "イ",
		explanation:
			"元の式を簡約化:\nAB~C∨ABC∨~AB~C∨~ABC\n= AB(~C∨C) ∨ ~AB(~C∨C)  （分配法則）\n= AB·1 ∨ ~AB·1\n= AB ∨ ~AB\n= (~A∨A)B  （分配法則）\n= 1·B\n= B\n\nしたがって、答えはイのB。",
	},
	{
		id: "exam3-2017-q3",
		number: 3,
		text: "次の真理値表の F の論理式を求めよ。",
		answer: "~x~y ∨ xy",
		explanation:
			"真理値表:\nX Y F\n0 0 1\n0 1 0\n1 0 0\n1 1 1\n\nFが1になる条件:\n- X=0, Y=0 → ~X∧~Y\n- X=1, Y=1 → X∧Y\n\nしたがって: F = ~X~Y ∨ XY\n\n別の表現: F = ~(X⊕Y) （XNOR: 排他的論理和の否定）",
		figureData: {
			type: "truthTable",
			columns: [
				{ key: "x", label: "X" },
				{ key: "y", label: "Y" },
				{ key: "f", label: "F" },
			],
			rows: [
				{ x: 0, y: 0, f: 1 },
				{ x: 0, y: 1, f: 0 },
				{ x: 1, y: 0, f: 0 },
				{ x: 1, y: 1, f: 1 },
			],
		},
	},
	{
		id: "exam3-2017-q4",
		number: 4,
		text: "0F₍₁₆₎⊕9D₍₁₆₎ を求め、16進数で表せ。（⊕はXOR演算を表す）",
		answer: "92",
		explanation:
			"16進数のXOR演算:\n0F₍₁₆₎ = 0000 1111₍₂₎\n9D₍₁₆₎ = 1001 1101₍₂₎\nXOR   = 1001 0010₍₂₎ = 92₍₁₆₎\n\n答え: 92",
	},
	{
		id: "exam3-2017-q5",
		number: 5,
		text: "78AB₍₁₆₎ ∧ 00FF₍₁₆₎ >>> 4 を求め、16進数で表せ。（∧はAND演算、>>>は右シフト演算を表す）",
		answer: "A",
		explanation:
			"演算の順序:\n1. 78AB₍₁₆₎ ∧ 00FF₍₁₆₎ を計算:\n   78AB₍₁₆₎ = 0111 1000 1010 1011₍₂₎\n   00FF₍₁₆₎ = 0000 0000 1111 1111₍₂₎\n   AND     = 0000 0000 1010 1011₍₂₎ = 00AB₍₁₆₎\n\n2. 00AB₍₁₆₎ >>> 4 （4ビット右シフト）:\n   00AB₍₁₆₎ = 0000 0000 1010 1011₍₂₎\n   >>> 4   = 0000 0000 0000 1010₍₂₎ = 000A₍₁₆₎ = A₍₁₆₎\n\n答え: A",
	},
];
