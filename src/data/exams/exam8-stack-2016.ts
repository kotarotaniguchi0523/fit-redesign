import type { Question } from "../../types/index";

/**
 * 小テスト8: データ構造（スタック）
 * 2016年度版
 * 注: 2016年度の問題6がこれに相当（Exam2016-Ans.htmlを参照）
 * PDFファイル（Exam8d-Stack.pdf）から問題文を取得
 */

export const exam8_2016: Question[] = [
	{
		id: "exam8-2016-q1",
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
		id: "exam8-2016-q2",
		number: 2,
		text: "計算結果を求める問題（2つの値を答える）",
		answer: "7, 51",
		explanation: "状態遷移や計算過程で得られる2つの値を求める",
	},
	{
		id: "exam8-2016-q3",
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
		id: "exam8-2016-q4",
		number: 4,
		text: "逆ポーランド記法の式を求める問題",
		answer: "AB+C*DA/-",
		explanation: "中置記法の式を逆ポーランド記法（後置記法）に変換する。スタックを使って変換を行う",
	},
	{
		id: "exam8-2016-q5",
		number: 5,
		text: "データ構造に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
		],
		answer: "エ",
		explanation: "スタック、キュー、リストなどのデータ構造の性質や操作に関する問題",
	},
];
