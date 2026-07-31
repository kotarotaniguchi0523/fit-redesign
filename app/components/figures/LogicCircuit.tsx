import type { JSX } from "hono/jsx/jsx-runtime";
import { getGateSymbolPath, getWirePath, LOGIC_DEFAULTS } from "../../lib/figures/logic-circuit";
import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types";

interface LogicCircuitProps {
	inputs: LogicInput[];
	outputs: LogicOutput[];
	gates: LogicGate[];
	wires: LogicWire[];
	width?: number;
	height?: number;
	responsive?: boolean;
	rasterTextOverlay?: boolean;
}

export function LogicCircuit({
	inputs,
	outputs,
	gates,
	wires,
	width = 500,
	height = 300,
	responsive = true,
	rasterTextOverlay = false,
}: LogicCircuitProps): JSX.Element {
	const circuit = (
		<svg
			width={responsive ? "100%" : width}
			height={responsive ? "auto" : height}
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			class={responsive ? "border border-gray-300 rounded max-w-full" : undefined}
			style={
				responsive
					? `aspect-ratio: ${width}/${height}; background-color: #fff`
					: "background-color: #fff"
			}
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

	if (!rasterTextOverlay) {
		return circuit;
	}

	const labelStyle = (x: number, y: number, fontSize: number): string =>
		`position:absolute;left:${x}px;top:${y}px;font-size:${fontSize}px;line-height:1;color:#000;transform:translate(-50%,-50%)`;

	return (
		<div style={`position:relative;width:${width}px;height:${height}px;background:#fff`}>
			{circuit}
			{inputs.map((input) => (
				<span style={labelStyle(input.x - 17, input.y, 14)}>{input.label}</span>
			))}
			{gates.map((gate) => (
				<span
					style={`${labelStyle(gate.x, gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15, 10)};font-weight:700`}
				>
					{gate.type}
				</span>
			))}
			{outputs.map((output) => (
				<span style={labelStyle(output.x + 17, output.y, 14)}>{output.label}</span>
			))}
		</div>
	);
}
