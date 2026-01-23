import type { Question } from "../../types/index";

/**
 * 小テスト4: 論理演算
 * 2017年度版（Exam4e-logic.pdf）
 */

export const exam4_2017: Question[] = [
	{
		id: "exam4-2017-q1",
		number: 1,
		text: "X={0,1}とする．2^X–X を求めよ．",
		answer: "{φ, {0}, {1}}",
		explanation:
			"2^X は X の冪集合（べき集合）を表す。X={0,1} の冪集合は {φ, {0}, {1}, {0,1}}。これから X={0,1} を引くと {φ, {0}, {1}}",
	},
	{
		id: "exam4-2017-q2",
		number: 2,
		text: "論理式 AB~C∨ABC∨~AB~C∨~ABC と恒等な式を選べ．",
		options: [
			{ label: "ア", value: "AB∨BC" },
			{ label: "イ", value: "B", isCorrect: true },
			{ label: "ウ", value: "ABC" },
			{ label: "エ", value: "B~C∨AC" },
		],
		answer: "イ",
		explanation: "与えられた論理式を簡単化すると B になる",
	},
	{
		id: "exam4-2017-q3",
		number: 3,
		text: "次の真理値表の F の論理式を求めよ．",
		answer: "~x+y ∨ xy",
		explanation: "真理値表から主加法標準形または主乗法標準形を導出する",
		figureDescription: "真理値表: X, Y, F の3列。(0,0,1), (0,1,0), (1,0,0), (1,1,1)",
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
				{ x: 1, y: 1, f: 1 },
			],
		},
	},
	{
		id: "exam4-2017-q4",
		number: 4,
		text: "0F(16)⊕9D(16) を求め、16進数で表せ．",
		answer: "92",
		explanation:
			"XOR演算: 0F(16) = 00001111(2), 9D(16) = 10011101(2), XOR結果 = 10010010(2) = 92(16)",
	},
	{
		id: "exam4-2017-q5",
		number: 5,
		text: "78AB(16) ∧ 00FF(16) >>> 4 を求め、16進数で表せ．",
		answer: "A",
		explanation: "AND演算後に右シフト: 78AB ∧ 00FF = 00AB, 00AB >>> 4 = 000A = A",
	},
];
