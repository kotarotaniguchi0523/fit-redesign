import type { Question } from "../../types/index";

/**
 * 小テスト6: FSM（有限オートマトン）
 * 2016年度版
 * 注: PDFファイル（Exam6d-FSM.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam6_2016: Question[] = [
	{
		id: "exam6-2016-q1",
		number: 1,
		text: "有限オートマトンに関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "", isCorrect: true },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ウ",
		explanation: "有限オートマトンの状態遷移や受理文字列に関する問題。PDFで詳細を確認",
	},
	{
		id: "exam6-2016-q2",
		number: 2,
		text: "計算結果を求める問題（2つの値を答える）",
		answer: "7, 51",
		explanation: "状態遷移や計算過程で得られる2つの値を求める",
	},
	{
		id: "exam6-2016-q3",
		number: 3,
		text: "選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "", isCorrect: true },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
		],
		answer: "イ",
		explanation: "オートマトンまたはBNF、正規表現に関する問題",
	},
	{
		id: "exam6-2016-q4",
		number: 4,
		text: "スタック操作のシーケンスを答える問題",
		answer: "push 1, push 2, push 3, pop, pop, push 4, pop, pop",
		explanation:
			"指定された結果を得るためのpush/pop操作の順序を答える。スタックはLIFO（後入れ先出し）の性質を持つ",
	},
	{
		id: "exam6-2016-q5",
		number: 5,
		text: "変数の値を求める問題",
		answer: "x=A, y=B",
		explanation: "プログラムやアルゴリズムの実行後の変数値を求める",
	},
];
