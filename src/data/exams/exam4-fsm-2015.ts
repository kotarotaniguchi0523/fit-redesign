import type { Question } from "../../types/index";

/**
 * 小テスト4: オートマトン・確率・データ構造
 * 2015年度版（Exam4c-FSM.pdf）
 */

export const exam4_2015: Question[] = [
	{
		id: "exam4-2015-q1",
		number: 1,
		text: "袋から球を取り出す確率問題",
		answer: "121/126",
		explanation: "確率の計算問題。異なる色の球が入った袋から複数個取り出す際の確率を求める",
	},
	{
		id: "exam4-2015-q2",
		number: 2,
		text: "小数の計算問題",
		answer: "0.977",
		explanation: "確率または統計に関連する小数計算",
	},
	{
		id: "exam4-2015-q3",
		number: 3,
		text: "有限オートマトンの状態遷移問題",
		answer: "ア 1, イ 0, ウ S0",
		explanation: "有限オートマトンの状態遷移図を解析し、特定の入力に対する状態遷移や出力を求める",
		figureDescription: "状態遷移図: 複数の状態ノードと遷移矢印で構成されるオートマトン",
	},
	{
		id: "exam4-2015-q4",
		number: 4,
		text: "オートマトンまたはBNFに関する選択問題",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ア",
		explanation: "オートマトンの性質またはBNFで定義される言語に関する問題",
	},
	{
		id: "exam4-2015-q5",
		number: 5,
		text: "数式を逆ポーランド記法で表せ（スタックベースの表記法）",
		answer: "(A-B)*(B+(C/D))",
		explanation:
			"通常の数式（中置記法）を逆ポーランド記法（後置記法）に変換、またはその逆変換を行う",
	},
];
