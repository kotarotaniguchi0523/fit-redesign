import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types";
import { pointsToPolyline } from "./svg-path";

export const LOGIC_DEFAULTS = {
	GATE_WIDTH: 50,
	GATE_HEIGHT: 40,
} as const;

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
	if (!(fromElement && toElement)) return null;

	const start =
		"label" in fromElement && inputs.includes(fromElement as LogicInput)
			? { x: fromElement.x + 20, y: fromElement.y }
			: { x: (fromElement as LogicGate).x + gateWidth / 2, y: (fromElement as LogicGate).y };
	const end =
		"label" in toElement && outputs.includes(toElement as LogicOutput)
			? { x: toElement.x - 20, y: toElement.y }
			: { x: (toElement as LogicGate).x - gateWidth / 2, y: (toElement as LogicGate).y };
	const points = wire.points?.length ? [start, ...wire.points, end] : [start, end];

	return pointsToPolyline(points);
}
