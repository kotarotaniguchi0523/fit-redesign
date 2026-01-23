import type { Question } from "../../types/index";

/**
 * 小テスト4: 論理演算
 * 2016年度版
 * 注: PDFファイル（Exam4d-logic.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam4_2016: Question[] = [
	{
		id: "exam4-2016-q1",
		number: 1,
		text: "{R,G,B}のべき集合を求めよ",
		answer: "{φ, {R}, {G}, {B}, {R,G}, {R,B}, {G,B}, {R,G,B}}",
		explanation:
			"集合{R,G,B}の冪集合（べき集合）は、全ての部分集合の集合。空集合を含む8個の部分集合が存在する",
	},
	{
		id: "exam4-2016-q2",
		number: 2,
		text: "~Y∨~XY と等価な式を全て選べ",
		options: [
			{ label: "ア", value: "~X∨~Y", isCorrect: true },
			{ label: "イ", value: "Y ∨ ~X~Y" },
			{ label: "ウ", value: "~(X∨Y)" },
			{ label: "エ", value: "~X~Y ∨ ~XY ∨ X~Y", isCorrect: true },
		],
		answer: "ア，エ",
		explanation: "~Y∨~XY = ~Y(1∨~X) ∨ ~XY = ~Y ∨ ~XY = ~Y ∨ ~X。アは~X∨~Yで同値。エは展開すると~X∨~Yに簡約される",
	},
	{
		id: "exam4-2016-q3",
		number: 3,
		text: "次の回路（NANDゲートとNOTゲートの組み合わせ）の論理式を求めよ",
		answer: "X = A̅ ∧ B̅",
		explanation: "回路図から論理式を導出。NANDの出力をNOTで反転するとANDになる",
		figureDescription: "論理回路図: AとBを入力とするNANDゲートとNOTゲートの組み合わせ",
	},
	{
		id: "exam4-2016-q4",
		number: 4,
		text: "3B₍₁₆₎⊕0F₍₁₆₎∨B3₍₁₆₎ を16進数で求めよ",
		answer: "B7",
		explanation: "3B⊕0F = 34₍₁₆₎。34∨B3 = 00110100∨10110011 = 10110111₍₂₎ = B7₍₁₆₎",
	},
	{
		id: "exam4-2016-q5",
		number: 5,
		text: "白5個、赤2個の壺から2個取り出す。A=1回目に赤、B=2回目に赤が出る事象とする。P(B̅|A)を求めよ",
		answer: "5/6",
		explanation: "Aが起きた後（赤1個取り出し済み）、残り6個中赤1個。B̅は2回目に赤が出ない確率 = 5/6",
	},
];
