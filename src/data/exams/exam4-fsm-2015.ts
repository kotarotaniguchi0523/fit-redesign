import type { Question } from "../../types/index";

/**
 * 小テスト4: 集合と論理
 * 2015年度版（Exam4c-logic.pdf）
 */

export const exam4_2015: Question[] = [
	{
		id: "exam4-2015-q1",
		number: 1,
		text: "X=3A₍₁₆₎について、(X>>4)|((X & F₍₁₆₎)<<4) を求めよ。(|は OR を表す)",
		answer: "A3",
		explanation:
			"X=3A₍₁₆₎=00111010₍₂₎。X>>4=00000011=3₍₁₆₎、X&F₍₁₆₎=0000101010₍₂₎=A₍₁₆₎、A<<4=10100000₍₂₎=A0₍₁₆₎。3₍₁₆₎|A0₍₁₆₎=A3₍₁₆₎。この操作は上位4ビットと下位4ビットを入れ替える（スワップ）処理",
	},
	{
		id: "exam4-2015-q2",
		number: 2,
		text: "論理式A ∨ (A ∧ B)と同値な式はどれか？",
		options: [
			{ label: "ア", value: "(A ∨ A) ∧ (A ∨ B)", isCorrect: true },
			{ label: "イ", value: "(A ∨ B) ∧ (A ∨ B̅)", isCorrect: false },
			{ label: "ウ", value: "(A̅ ∨ B) ∧ (A ∨ B̅)", isCorrect: false },
			{ label: "エ", value: "(A ∨ B̅) ∧ (B ∨ B̅)", isCorrect: false },
		],
		answer: "ア",
		explanation:
			"分配法則を使用: A ∨ (A ∧ B) = (A ∨ A) ∧ (A ∨ B)。さらに簡約するとA ∨ (A ∧ B) = A（吸収律）",
	},
	{
		id: "exam4-2015-q3",
		number: 3,
		text: "2ビットの値(a₁ a₀)と(b₁ b₀)の和(s₂ s₁ s₀)とする。s₂を求める式はどれか？",
		options: [
			{ label: "ア", value: "a₀ b₀", isCorrect: false },
			{ label: "イ", value: "a₁ ⊕ b₁ ⊕ a₀b₀", isCorrect: false },
			{ label: "ウ", value: "a₁b₁ ∨ a₁a₀b₀ ∨ a₀b₀b₁", isCorrect: true },
			{ label: "エ", value: "a₀ ⊕ b₀", isCorrect: false },
		],
		answer: "ウ",
		explanation:
			"2ビット加算器の桁上げ(carry)を求める問題。s₂は最上位ビットの桁上げで、a₁とb₁の両方が1の場合、またはどちらか一方が1で下位ビットからの桁上げ(a₀b₀)がある場合に1となる。式: a₁b₁ ∨ a₁a₀b₀ ∨ a₀b₀b₁",
	},
	{
		id: "exam4-2015-q4",
		number: 4,
		text: "F=X̅ ∧ Y̅の真理値表をかけ",
		answer: "1,0,0,0",
		explanation:
			"X=0,Y=0: X̅=1,Y̅=1なのでF=1∧1=1、X=0,Y=1: X̅=1,Y̅=0なのでF=1∧0=0、X=1,Y=0: X̅=0,Y̅=1なのでF=0∧1=0、X=1,Y=1: X̅=0,Y̅=0なのでF=0∧0=0。Fの列は(1,0,0,0)。これはNORゲートと同じ動作",
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
				{ x: 1, y: 1, f: 0 },
			],
		},
	},
	{
		id: "exam4-2015-q5",
		number: 5,
		text: "A={1,2,3}の時|2^A|を求めよ",
		answer: "8",
		explanation:
			"2^Aは集合Aのべき集合（すべての部分集合の集合）を表す。A={1,2,3}のべき集合は: {}, {1}, {2}, {3}, {1,2}, {1,3}, {2,3}, {1,2,3}の8個。一般に|A|=nの時、|2^A|=2^n。この場合|A|=3なので|2^A|=2³=8",
	},
];
