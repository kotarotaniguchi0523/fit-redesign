import type { Question } from "../../types/index";

/**
 * 小テスト3: 集合・論理演算
 * 2015年度版（Exam3c-logic.pdf）
 */

export const exam3_2015: Question[] = [
	{
		id: "exam3-2015-q1",
		number: 1,
		text: "16進数の論理演算を求めよ",
		answer: "A3",
		explanation: "16進数同士の論理演算（AND, OR, XORなど）を実行し、結果を16進数で表す",
	},
	{
		id: "exam3-2015-q2",
		number: 2,
		text: "論理式に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "" },
			{ label: "エ", value: "", isCorrect: true },
			{ label: "オ", value: "" },
		],
		answer: "エ",
		explanation: "論理式の性質や変換に関する問題",
	},
	{
		id: "exam3-2015-q3",
		number: 3,
		text: "集合演算に関する選択問題",
		options: [
			{ label: "ア", value: "" },
			{ label: "イ", value: "" },
			{ label: "ウ", value: "", isCorrect: true },
			{ label: "エ", value: "" },
			{ label: "オ", value: "" },
		],
		answer: "ウ",
		explanation: "集合の演算（和、積、差、補集合など）に関する問題",
	},
	{
		id: "exam3-2015-q4",
		number: 4,
		text: "真理値表からFの論理式を求めよ",
		answer: "X+Y (X OR Y)",
		explanation: "真理値表から主加法標準形または主乗法標準形を導出する",
		figureDescription: "真理値表: X, Y, F の3列",
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
				{ x: 1, y: 1, f: 1 },
			],
		},
	},
	{
		id: "exam3-2015-q5",
		number: 5,
		text: "ビットシフト演算の結果を求めよ",
		answer: "8",
		explanation: "ビット演算（シフト演算）の結果を10進数で表す",
	},
];
