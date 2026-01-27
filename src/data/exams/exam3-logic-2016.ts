import type { Question } from "../../types/index";

/**
 * 小テスト3: 集合・論理演算
 * 2016年度版
 * PDFファイル: Exam4d-logic.pdf
 */

export const exam3_2016: Question[] = [
	{
		id: "exam3-2016-q1",
		number: 1,
		text: "{R,G,B}のべき集合を求めよ。",
		answer: "{{R}, {G}, {B}, {R,G}, {R,B}, {G,B}, {R,G,B}, φ}",
		explanation:
			"べき集合（冪集合）は、与えられた集合のすべての部分集合を要素とする集合。\n{R,G,B}のべき集合は:\n- 空集合: φ (または {})\n- 1要素: {R}, {G}, {B}\n- 2要素: {R,G}, {R,B}, {G,B}\n- 3要素: {R,G,B}\n\n要素数3の集合のべき集合の要素数は 2³ = 8個。",
	},
	{
		id: "exam3-2016-q2",
		number: 2,
		text: "~Y∨~XY と等価な式を全て選べ。\nア ~X∨~Y\nイ Y ∨ ~X~Y\nウ ~(X∨Y)\nエ ~X~Y ∨ ~XY ∨ X~Y",
		options: [
			{ label: "ア", value: "~X∨~Y", isCorrect: true },
			{ label: "イ", value: "Y ∨ ~X~Y" },
			{ label: "ウ", value: "~(X∨Y)" },
			{ label: "エ", value: "~X~Y ∨ ~XY ∨ X~Y", isCorrect: true },
		],
		answer: "ア, エ",
		explanation:
			"元の式を簡約化:\n~Y∨~XY = ~Y∨(~X∧Y) = (~Y∨~X)∧(~Y∨Y) = (~Y∨~X)∧1 = ~X∨~Y\n\nア: ~X∨~Y （一致）\nイ: Y ∨ ~X~Y = Y∨(~X∧~Y) （異なる）\nウ: ~(X∨Y) = ~X∧~Y （ド・モルガンの法則、異なる）\nエ: ~X~Y ∨ ~XY ∨ X~Y = ~X(~Y∨Y) ∨ X~Y = ~X ∨ X~Y = (~X∨X)∧(~X∨~Y) = ~X∨~Y （一致）\n\n正解: ア, エ",
	},
	{
		id: "exam3-2016-q3",
		number: 3,
		text: "次の回路の論理式を求めよ。",
		answer: "X = A ∨ B̅",
		explanation:
			"回路図から論理式を導出する問題。\n上段のAはそのままORゲートへ、下段のBはNOTを通ってORゲートへ入力。\n結果: X = A ∨ ~B",
		figureData: {
			type: "logicCircuit",
			inputs: [
				{ id: "A", label: "A", x: 50, y: 60 },
				{ id: "B", label: "B", x: 50, y: 120 },
			],
			gates: [
				{ id: "NOT1", type: "NOT", x: 120, y: 120 },
				{ id: "OR1", type: "OR", x: 200, y: 90 },
			],
			outputs: [{ id: "X", label: "X", x: 300, y: 90, input: "OR1" }],
			wires: [
				{
					from: "A",
					to: "OR1",
					points: [
						{ x: 100, y: 60 },
						{ x: 100, y: 80 },
					],
				},
				{ from: "B", to: "NOT1" },
				{
					from: "NOT1",
					to: "OR1",
					points: [
						{ x: 160, y: 120 },
						{ x: 160, y: 100 },
					],
				},
				{ from: "OR1", to: "X" },
			],
		},
	},
	{
		id: "exam3-2016-q4",
		number: 4,
		text: "3B⊕0F∨B3 を求めよ。（⊕はXOR演算、∨はOR演算を表す）",
		answer: "B7",
		explanation:
			"16進数で計算:\n1. 3B ⊕ 0F を計算:\n   3B₍₁₆₎ = 0011 1011₍₂₎\n   0F₍₁₆₎ = 0000 1111₍₂₎\n   XOR   = 0011 0100₍₂₎ = 34₍₁₆₎\n\n2. 34 ∨ B3 を計算:\n   34₍₁₆₎ = 0011 0100₍₂₎\n   B3₍₁₆₎ = 1011 0011₍₂₎\n   OR    = 1011 0111₍₂₎ = B7₍₁₆₎\n\n答え: B7",
	},
	{
		id: "exam3-2016-q5",
		number: 5,
		text: "白5個、赤2個の壺から2個取り出す。A=1回目に赤、B=2回目に赤が出る事象とする。P(B̄|A) を求めよ。",
		answer: "5/6",
		explanation:
			"条件付き確率 P(B̄|A) = 「1回目に赤を引いた条件下で、2回目に赤を引かない（白を引く）確率」\n\n1回目に赤を引いた後の壺の状態:\n- 白: 5個\n- 赤: 1個（2個あったうち1個を取り出した）\n- 合計: 6個\n\n2回目に白を引く確率 = 5/6",
	},
];
