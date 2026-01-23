import type { Question } from "../../types/index";

/**
 * 小テスト2: 負数表現 / 論理演算
 * 2014年度版（Exam2b-Negative.pdf）
 * 注: 2014年度は小テスト2が負数表現+論理演算の複合問題
 */

export const exam4_2014: Question[] = [
	{
		id: "exam4-2014-q1",
		number: 1,
		text: "byte型の整数で100+100を求めると-56になる誤りを何というか",
		answer: "オーバーフロー",
		explanation:
			"100 + 100 = 200。byte型は-128から127までの範囲しか表現できないため、200は範囲外となりオーバーフローが発生し、-56となる",
	},
	{
		id: "exam4-2014-q2",
		number: 2,
		text: "Xを8bitの整数D9とする。X>>3（右へ算術シフト）を計算せよ",
		answer: "FB",
		explanation:
			"D9(16) = 11011001(2)。算術右シフト3ビット: 11111011(2) = FB(16)。最上位ビット（符号ビット）を保持する",
	},
	{
		id: "exam4-2014-q3",
		number: 3,
		text: "89(16) ∧ AB(16) ⊕ CD(16)を計算せよ",
		answer: "44",
		explanation:
			"89(16) = 10001001(2), AB(16) = 10101011(2), CD(16) = 11001101(2)。まずAND: 89 ∧ AB = 10001001(2)。次にXOR: 10001001 ⊕ 11001101 = 01000100(2) = 44(16)",
	},
	{
		id: "exam4-2014-q4",
		number: 4,
		text: "A̅∨̅B̅∨C̅̅̅̅̅̅̅̅̅̅（オーバーラインはA∨Bとその全体に対するCの否定）と恒等な論理式を求めよ",
		options: [
			{ label: "ア", value: "A∧B ∨ A∧C̅" },
			{ label: "イ", value: "A∧C̅ ∨ B" },
			{ label: "ウ", value: "A∧B ∨ B∧C" },
			{ label: "エ", value: "A∧C̅ ∨ B∧C̅", isCorrect: true },
		],
		answer: "エ",
		explanation:
			"ド・モルガンの定理を適用: A̅∨̅B̅∨C̅̅̅̅̅̅̅̅̅̅ = (A∨B)̅ ∨ C̅ = A̅∧B̅ ∨ C̅。さらに変形すると A∧C̅ ∨ B∧C̅ = (A∨B)∧C̅",
	},
	{
		id: "exam4-2014-q5",
		number: 5,
		text: "次の回路図の真理値表をかけ",
		answer: "XY: 0001, ~X+Y: 1000, F: 0110",
		explanation: "回路図から論理式を導出し、真理値表を作成する",
		figureDescription: "論理回路図: XとYを入力とする回路",
		figureData: {
			type: "truthTable",
			columns: [
				{ key: "x", label: "X" },
				{ key: "y", label: "Y" },
				{ key: "f", label: "F" },
			],
			rows: [
				{ x: 0, y: 0, f: 0 },
				{ x: 0, y: 1, f: 1 },
				{ x: 1, y: 0, f: 1 },
				{ x: 1, y: 1, f: 0 },
			],
		},
	},
];
