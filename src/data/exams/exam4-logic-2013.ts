import type { Question } from "../../types/index";

/**
 * 小テスト4: 集合と論理
 * 2013年度版
 */

export const exam4_2013: Question[] = [
	{
		id: "exam4-2013-q1",
		number: 1,
		text: "X=3E₍₁₆₎=111110₍₂₎について、X⊕FF₍₁₆₎+1 を16進数で求めよ",
		answer: "C2",
		explanation: "3E⊕FF = 11000001₍₂₎ = C1₍₁₆₎、C1+1 = C2₍₁₆₎。これは2の補数を求める操作",
	},
	{
		id: "exam4-2013-q2",
		number: 2,
		text: "次の回路図のZを式で表せ（X,Yを入力とするNAND/AND/OR回路）",
		answer: "Z = X ⊕ Y (= X̅Y + XY̅)",
		explanation:
			"上段: NOR(X, Y) = (X+Y)̅\n下段: NOR(X̅, Y̅) = XY\nZ = NOR((X+Y)̅, XY) = ((X+Y)̅ + XY)̅ = (X+Y)(XY)̅ = (X+Y)(X̅+Y̅) = XY̅ + X̅Y = X ⊕ Y",
		figureDescription: "論理回路図",
		figureData: {
			type: "logicCircuit",
			inputs: [
				{ id: "X", label: "X", x: 50, y: 60 },
				{ id: "Y", label: "Y", x: 50, y: 100 },
			],
			gates: [
				{ id: "NOR1", type: "NOR", x: 200, y: 80 },
				{ id: "NOT1", type: "NOT", x: 160, y: 160 },
				{ id: "NOT2", type: "NOT", x: 160, y: 210 },
				{ id: "NOR2", type: "NOR", x: 280, y: 185 },
				{ id: "NOR3", type: "NOR", x: 400, y: 130 },
			],
			outputs: [{ id: "Z", label: "Z", x: 480, y: 130, input: "NOR3" }],
			wires: [
				// X to NOR1
				{
					from: "X",
					to: "NOR1",
					points: [
						{ x: 160, y: 60 },
						{ x: 160, y: 80 },
					],
				},
				// Y to NOR1
				{
					from: "Y",
					to: "NOR1",
					points: [
						{ x: 160, y: 100 },
						{ x: 160, y: 80 },
					],
				},
				// X to NOT1 (branch down)
				{
					from: "X",
					to: "NOT1",
					points: [
						{ x: 70, y: 60 },
						{ x: 70, y: 160 },
					],
				},
				// Y to NOT2 (branch down)
				{
					from: "Y",
					to: "NOT2",
					points: [
						{ x: 90, y: 100 },
						{ x: 90, y: 210 },
					],
				},
				// NOT1 to NOR2
				{
					from: "NOT1",
					to: "NOR2",
					points: [
						{ x: 240, y: 160 },
						{ x: 240, y: 185 },
					],
				},
				// NOT2 to NOR2
				{
					from: "NOT2",
					to: "NOR2",
					points: [
						{ x: 240, y: 210 },
						{ x: 240, y: 185 },
					],
				},
				// NOR1 to NOR3
				{
					from: "NOR1",
					to: "NOR3",
					points: [
						{ x: 340, y: 80 },
						{ x: 340, y: 130 },
					],
				},
				// NOR2 to NOR3
				{
					from: "NOR2",
					to: "NOR3",
					points: [
						{ x: 340, y: 185 },
						{ x: 340, y: 130 },
					],
				},
				// NOR3 to Z
				{ from: "NOR3", to: "Z" },
			],
		},
	},
	{
		id: "exam4-2013-q3",
		number: 3,
		text: "X̅+Y̅+(X̅+Y)（全体にオーバーライン）を加法標準形にせよ",
		answer: "X̅Y + XY̅",
		explanation: "ド・モルガンの定理を適用して加法標準形（主加法標準形）に変換する",
	},
	{
		id: "exam4-2013-q4",
		number: 4,
		text: "F=(X+Y)∧(X+Y̅)の真理値表をかけ",
		answer: "0,0,1,1",
		explanation: "X=0,Y=0: F=0、X=0,Y=1: F=0、X=1,Y=0: F=1、X=1,Y=1: F=1。Fの列は(0,0,1,1)",
		figureData: {
			type: "truthTable",
			columns: [
				{ key: "x", label: "X" },
				{ key: "y", label: "Y" },
				{ key: "f", label: "F" },
			],
			rows: [
				{ x: 0, y: 0, f: 0 },
				{ x: 0, y: 1, f: 0 },
				{ x: 1, y: 0, f: 1 },
				{ x: 1, y: 1, f: 1 },
			],
		},
	},
	{
		id: "exam4-2013-q5",
		number: 5,
		text: "A={2,3,5,7}, B={2,4,6,8}, C={3,4}, U={1,...,10}の時、A̅∪B̅∩C（全体にオーバーライン）を求めよ",
		answer: "{1,5,6,7,8,9,10}",
		explanation:
			"ド・モルガンの定理: A̅∪B̅∩C = (A∩B)∪C̅ = {2}∪{1,2,5,6,7,8,9,10} = {1,2,5,6,7,8,9,10}。ただし問題の解釈により異なる場合あり",
	},
];
