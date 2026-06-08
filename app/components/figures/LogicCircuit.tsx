import { getGateSymbolPath, getWirePath, LOGIC_DEFAULTS } from "../../lib/figures/logic-circuit";
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types";

interface LogicCircuitProps {
	inputs: LogicInput[];
	outputs: LogicOutput[];
	gates: LogicGate[];
	wires: LogicWire[];
	width?: number;
	height?: number;
}

export function LogicCircuit({
	inputs,
	outputs,
	gates,
	wires,
	width = 500,
	height = 300,
}: LogicCircuitProps) {
	return (
		<svg
			width="100%"
			height="auto"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			class="border border-gray-300 rounded max-w-full"
			style={`aspect-ratio: ${width}/${height}`}
			aria-label="Logic circuit diagram"
		>
			<title>Logic circuit diagram</title>

			{wires.map((wire) => {
				const pathData = getWirePath(wire, inputs, outputs, gates);
				return pathData ? (
					<g>
						<path d={pathData} stroke="black" stroke-width="1.5" fill="none" />
					</g>
				) : null;
			})}

			{inputs.map((input) => (
				<g>
					<circle cx={input.x} cy={input.y} r="4" fill="black" />
					<text
						x={input.x - 10}
						y={input.y}
						font-size="14"
						text-anchor="end"
						dominant-baseline="middle"
						fill="black"
					>
						{input.label}
					</text>
				</g>
			))}

			{gates.map((gate) => (
				<g>
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: ロジックゲートの SVG シンボルを framework 非依存の lib から注入 */}
					<g dangerouslySetInnerHTML={{ __html: getGateSymbolPath(gate) }} />
					<text
						x={gate.x}
						y={gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15}
						font-size="10"
						text-anchor="middle"
						fill="black"
						font-weight="bold"
					>
						{gate.type}
					</text>
				</g>
			))}

			{outputs.map((output) => (
				<g>
					<circle cx={output.x} cy={output.y} r="4" fill="black" />
					<text
						x={output.x + 10}
						y={output.y}
						font-size="14"
						text-anchor="start"
						dominant-baseline="middle"
						fill="black"
					>
						{output.label}
					</text>
				</g>
			))}
		</svg>
	);
}
