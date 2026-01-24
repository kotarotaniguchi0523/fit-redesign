import type { Question } from "../../types/index";

/**
 * 小テスト3: 集合・論理演算
 * 2015年度版（Exam3c-logic.pdf）
 */

export const exam3_2015: Question[] = [
	{
		id: "exam3-2015-q1",
		number: 1,
		text: "X=3A₍₁₆₎について、(X>>4)|((X & F₍₁₆₎)<<4) を16進数で求めよ（|はORを表す）",
		answer: "A3",
		explanation:
			"X=3A₍₁₆₎=00111010₍₂₎。X>>4=00000011₍₂₎=03₍₁₆₎。X&F=0000 1010₍₂₎=0A₍₁₆₎。(X&F)<<4=10100000₍₂₎=A0₍₁₆₎。03|A0=A3₍₁₆₎",
	},
	{
		id: "exam3-2015-q2",
		number: 2,
		text: "論理式 B̅ ∨ (A ∧ B) と同値な式はどれか？",
		options: [
			{ label: "ア", value: "(A ∨ A̅) ∧ (A ∨ B)" },
			{ label: "イ", value: "(A ∨ B̅) ∧ (A̅ ∨ B̅)" },
			{ label: "ウ", value: "(A̅ ∨ B) ∧ (A̅ ∨ B̅)" },
			{ label: "エ", value: "(A ∨ B̅) ∧ (B ∨ B̅)", isCorrect: true },
		],
		answer: "エ",
		explanation:
			"B̅ ∨ (A ∧ B) = (B̅ ∨ A) ∧ (B̅ ∨ B) = (A ∨ B̅) ∧ 1 = A ∨ B̅。エも同様にA ∨ B̅に簡約される",
	},
	{
		id: "exam3-2015-q3",
		number: 3,
		text: "2ビットの値(a₁ a₀)と(b₁ b₀)の和(s₂ s₁ s₀)とする。s₂を求める式はどれか？",
		options: [
			{ label: "ア", value: "a₀b₀" },
			{ label: "イ", value: "a₁ ⊕ b₁ ⊕ a₀b₀" },
			{ label: "ウ", value: "a₁b₁ ∨ a₁a₀b₀ ∨ a₀b₀b₁", isCorrect: true },
			{ label: "エ", value: "a₀ ⊕ b₀" },
		],
		answer: "ウ",
		explanation:
			"s₂は最上位桁への桁上げ。c₁（下位からの桁上げ）= a₀b₀。s₂ = a₁b₁ ∨ (a₁ ⊕ b₁)c₀ = a₁b₁ ∨ a₁a₀b₀ ∨ a₀b₀b₁",
	},
	{
		id: "exam3-2015-q4",
		number: 4,
		text: "F = X̅ ∧ Y̅ の真理値表をかけ",
		answer: "1,0,0,0",
		explanation: "X̅ ∧ Y̅ = (X ∨ Y)̅（ド・モルガン）= NOR。(0,0)→1, (0,1)→0, (1,0)→0, (1,1)→0",
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
		id: "exam3-2015-q5",
		number: 5,
		text: "A={1,2,3}の時 |2^A| を求めよ",
		answer: "8",
		explanation:
			"2^Aは集合Aの冪集合（べき集合）。要素数nの集合の冪集合の要素数は2^n。|A|=3なので|2^A|=2³=8",
	},
];
