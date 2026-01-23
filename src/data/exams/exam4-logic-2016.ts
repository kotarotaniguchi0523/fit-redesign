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
		text: "X={R,G,B}とする。2^X（Xの冪集合）を求めよ",
		answer: "{{R}, {G}, {B}, {R,G}, {R,B}, {G,B}, {R,G,B}, φ}",
		explanation:
			"集合Xの冪集合（べき集合）は、Xの全ての部分集合の集合。空集合を含む8個の部分集合が存在する",
	},
	{
		id: "exam4-2016-q2",
		number: 2,
		text: "論理式に関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "" },
		],
		answer: "ア，エ",
		explanation: "論理式の恒等性または簡単化に関する問題",
	},
	{
		id: "exam4-2016-q3",
		number: 3,
		text: "真理値表から論理式を求める問題",
		answer: "x= AB ∨ ~B",
		explanation: "真理値表から主加法標準形または主乗法標準形を導出する",
	},
	{
		id: "exam4-2016-q4",
		number: 4,
		text: "16進数のビット演算問題",
		answer: "B7",
		explanation: "16進数でのAND、OR、XOR、シフト演算などの計算",
	},
	{
		id: "exam4-2016-q5",
		number: 5,
		text: "確率の計算問題",
		answer: "5/6",
		explanation: "事象の確率計算または条件付確率の問題",
	},
];
