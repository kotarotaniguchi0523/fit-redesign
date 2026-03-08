import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types/index";

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
	if (!fromElement || !toElement) return null;

	let startX: number;
	let startY: number;
	let endX: number;
	let endY: number;

	if ("label" in fromElement && inputs.includes(fromElement as LogicInput)) {
		startX = fromElement.x + 20;
		startY = fromElement.y;
	} else {
		const gate = fromElement as LogicGate;
		startX = gate.x + gateWidth / 2;
		startY = gate.y;
	}

	if ("label" in toElement && outputs.includes(toElement as LogicOutput)) {
		endX = toElement.x - 20;
		endY = toElement.y;
	} else {
		const gate = toElement as LogicGate;
		endX = gate.x - gateWidth / 2;
		endY = gate.y;
	}

	let pathData: string;
	if (wire.points && wire.points.length > 0) {
		pathData = `M ${startX} ${startY}`;
		for (const point of wire.points) {
			pathData += ` L ${point.x} ${point.y}`;
		}
		pathData += ` L ${endX} ${endY}`;
	} else {
		pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
	}

	return pathData;
}
