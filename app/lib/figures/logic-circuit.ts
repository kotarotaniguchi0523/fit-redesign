import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types";
import { pointsToPolyline } from "./svg-path";

export const LOGIC_DEFAULTS = {
	GATE_WIDTH: 50,
	GATE_HEIGHT: 40,
} as const;

export interface LogicCircuitViewport {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * 回路の実要素だけを囲む viewBox。固定 500x300 の余白を除き、狭い画面でも
 * ゲートとラベルへ使える表示面積を確保する。
 */
export function getLogicCircuitViewport(
	inputs: LogicInput[],
	outputs: LogicOutput[],
	gates: LogicGate[],
	wires: LogicWire[],
): LogicCircuitViewport {
	const points = [
		...inputs.flatMap((input) => [
			{ x: input.x - 34, y: input.y - 18 },
			{ x: input.x + 4, y: input.y + 18 },
		]),
		...outputs.flatMap((output) => [
			{ x: output.x - 4, y: output.y - 18 },
			{ x: output.x + 34, y: output.y + 18 },
		]),
		...gates.flatMap((gate) => [
			{
				x: gate.x - LOGIC_DEFAULTS.GATE_WIDTH / 2 - 8,
				y: gate.y - LOGIC_DEFAULTS.GATE_HEIGHT / 2 - 8,
			},
			{
				x: gate.x + LOGIC_DEFAULTS.GATE_WIDTH / 2 + 12,
				y: gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 30,
			},
		]),
		...wires.flatMap((wire) => wire.points ?? []),
	];

	if (points.length === 0) {
		return { x: 0, y: 0, width: 1, height: 1 };
	}

	const minX = Math.min(...points.map((point) => point.x));
	const maxX = Math.max(...points.map((point) => point.x));
	const minY = Math.min(...points.map((point) => point.y));
	const maxY = Math.max(...points.map((point) => point.y));

	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
	};
}

export function getGateSymbolPath(
	gate: LogicGate,
	gateWidth = LOGIC_DEFAULTS.GATE_WIDTH,
	gateHeight = LOGIC_DEFAULTS.GATE_HEIGHT,
): string {
	const { x, y, type } = gate;
	switch (type) {
		case "AND":
			return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x} ${y - gateHeight / 2} A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		case "OR":
			return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		case "NOT":
			return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x + gateWidth / 3} ${y} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + gateWidth / 3 + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		case "NAND":
			return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x} ${y - gateHeight / 2} A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		case "NOR":
			return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		case "XOR":
			return `<g>
        <path d="M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}" fill="none" stroke="black" stroke-width="1.5" />
      </g>`;
		case "XNOR":
			return `<g>
        <path d="M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}" fill="none" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 10}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
		default:
			return "";
	}
}

export function getWirePath(
	wire: LogicWire,
	inputs: LogicInput[],
	outputs: LogicOutput[],
	gates: LogicGate[],
	gateWidth = LOGIC_DEFAULTS.GATE_WIDTH,
): string | null {
	const elementMap = new Map([...inputs, ...gates, ...outputs].map((el) => [el.id, el]));
	const fromElement = elementMap.get(wire.from);
	const toElement = elementMap.get(wire.to);
	if (!(fromElement && toElement)) {
		return null;
	}

	// 入力/出力の判定は id 集合で行う（全要素が x/y を持つため要素自体の as キャストは不要）。
	const inputIds = new Set(inputs.map((input) => input.id));
	const outputIds = new Set(outputs.map((output) => output.id));

	const start = inputIds.has(fromElement.id)
		? { x: fromElement.x + 20, y: fromElement.y }
		: { x: fromElement.x + gateWidth / 2, y: fromElement.y };
	const end = outputIds.has(toElement.id)
		? { x: toElement.x - 20, y: toElement.y }
		: { x: toElement.x - gateWidth / 2, y: toElement.y };
	const wirePoints = wire.points ?? [];
	const points = wirePoints.length > 0 ? [start, ...wirePoints, end] : [start, end];

	return pointsToPolyline(points);
}
