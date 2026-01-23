import type { Question } from "../../types/index";

/**
 * 小テスト4: 論理演算
 * 2017年度版（Exam4e-logic.pdf）
 */

export const exam4_2017: Question[] = [
	{
		id: "exam4-2017-q1",
		number: 1,
		text: "X={0,1}とする。2^X − X を求めよ",
		answer: "{φ, {0,1}}",
		explanation:
			"2^X は X の冪集合（べき集合）を表す。X={0,1} の冪集合は {φ, {0}, {1}, {0,1}}。これから X={{0},{1}} の要素を引くと {φ, {0,1}}",
	},
	{
		id: "exam4-2017-q2",
		number: 2,
		text: "論理式 ABC̅∨ABC∨A̅BC̅∨A̅BC と恒等な式を選べ",
		options: [
			{ label: "ア", value: "AB∨BC" },
			{ label: "イ", value: "B", isCorrect: true },
			{ label: "ウ", value: "ABC" },
			{ label: "エ", value: "BC̅∨AC" },
		],
		answer: "イ",
		explanation: "ABC̅∨ABC = AB(C̅∨C) = AB。A̅BC̅∨A̅BC = A̅B(C̅∨C) = A̅B。AB∨A̅B = B(A∨A̅) = B",
	},
	{
		id: "exam4-2017-q3",
		number: 3,
		text: "次の真理値表の F の論理式を求めよ",
		answer: "X̅Y̅ ∨ XY",
		explanation: "F=1となるのは(0,0)と(1,1)。X̅Y̅ ∨ XY = X⊙Y（XNOR、同値）",
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
		text: "0F₍₁₆₎⊕9D₍₁₆₎ を16進数で求めよ",
		answer: "92",
		explanation:
			"XOR演算: 0F₍₁₆₎ = 00001111₍₂₎, 9D₍₁₆₎ = 10011101₍₂₎, XOR結果 = 10010010₍₂₎ = 92₍₁₆₎",
	},
	{
		id: "exam4-2017-q5",
		number: 5,
		text: "78AB₍₁₆₎ ∧ 00FF₍₁₆₎ >>> 4 を16進数で求めよ",
		answer: "A",
		explanation: "AND演算後に論理右シフト: 78AB ∧ 00FF = 00AB, 00AB >>> 4 = 000A = A₍₁₆₎",
	},
];
