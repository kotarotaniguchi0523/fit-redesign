import type { Question } from "../../types/index";

/**
 * 小テスト7: 符号理論（Error Correcting Code）
 * 2016年度版
 * 注: PDFファイル（Exam7d-ECC.pdf）から問題文を取得。解答はExam2016-Ans.htmlを参照
 */

export const exam7_2016: Question[] = [
	{
		id: "exam7-2016-q1",
		number: 1,
		text: "平均符号長を求める問題",
		answer: "1.48 bit/symbol",
		explanation: "各文字の生起確率と符号長から平均符号長を計算。平均符号長 = Σ(確率×符号長)",
	},
	{
		id: "exam7-2016-q2",
		number: 2,
		text: "符号語を求める問題（7ビット）",
		answer: "1011010 (7ビット）",
		explanation: "ハフマン符号化やその他の符号化方式で符号語を導出",
	},
	{
		id: "exam7-2016-q3",
		number: 3,
		text: "符号理論に関する選択問題（複数選択）",
		options: [
			{ label: "ア", value: "", isCorrect: true },
			{ label: "イ", value: "", isCorrect: true },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "" },
		],
		answer: "ア，イ",
		explanation: "符号の性質、誤り検出・訂正能力などに関する問題",
	},
	{
		id: "exam7-2016-q4",
		number: 4,
		text: "16進数で値を求める問題",
		answer: "CA",
		explanation: "パリティビットやチェックサムの計算結果を16進数で表す",
	},
	{
		id: "exam7-2016-q5",
		number: 5,
		text: "符号理論に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
		],
		answer: "エ",
		explanation: "CRC符号、ハミング符号などの符号理論の性質に関する問題",
	},
];
