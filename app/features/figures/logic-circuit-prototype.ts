import type { FigureData } from "../../types";

export type LogicCircuitFigureData = Extract<FigureData, { type: "logicCircuit" }>;

export interface FigureCanvas {
	readonly width: number;
	readonly height: number;
}

export interface LogicCircuitPrototype {
	readonly slug: "logic-gates";
	readonly title: string;
	readonly description: string;
	readonly canvas: FigureCanvas;
	readonly figure: LogicCircuitFigureData;
}

/** AND / OR / NOT / NAND の形と接続を一画面で確認するための基準データ。 */
export const LOGIC_CIRCUIT_PROTOTYPE = {
	slug: "logic-gates",
	title: "論理回路図",
	description: "AND・OR・NOT・NANDの記号と配線を確認するプレビューです。",
	canvas: { width: 760, height: 260 },
	figure: {
		type: "logicCircuit",
		inputs: [
			{ id: "x", label: "X", x: 45, y: 70 },
			{ id: "y", label: "Y", x: 45, y: 150 },
		],
		gates: [
			{ id: "and", type: "AND", x: 180, y: 70 },
			{ id: "or", type: "OR", x: 330, y: 150 },
			{ id: "not", type: "NOT", x: 480, y: 150 },
			{ id: "nand", type: "NAND", x: 625, y: 105 },
		],
		outputs: [{ id: "f", label: "F", x: 725, y: 105, input: "nand" }],
		width: 760,
		height: 260,
		wires: [
			{ from: "x", to: "and" },
			{
				from: "y",
				to: "and",
				points: [
					{ x: 110, y: 150 },
					{ x: 110, y: 70 },
				],
			},
			{
				from: "x",
				to: "or",
				points: [
					{ x: 250, y: 70 },
					{ x: 250, y: 150 },
				],
			},
			{ from: "y", to: "or" },
			{ from: "or", to: "not" },
			{
				from: "and",
				to: "nand",
				points: [
					{ x: 555, y: 70 },
					{ x: 555, y: 105 },
				],
			},
			{
				from: "not",
				to: "nand",
				points: [
					{ x: 555, y: 150 },
					{ x: 555, y: 105 },
				],
			},
			{ from: "nand", to: "f" },
		],
	},
} as const satisfies LogicCircuitPrototype;
