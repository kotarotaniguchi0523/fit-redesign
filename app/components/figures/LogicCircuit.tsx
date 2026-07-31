import type { JSX } from "hono/jsx/jsx-runtime";
import {
	getGateSymbolPath,
	getLogicCircuitViewport,
	getWirePath,
	LOGIC_DEFAULTS,
} from "../../lib/figures/logic-circuit";
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
	const viewport = responsive
		? getLogicCircuitViewport(inputs, outputs, gates, wires)
		: { x: 0, y: 0, width, height };
	const showSvgLabels = !(responsive || rasterTextOverlay);
	const circuit = (
		<svg
			width={responsive ? "100%" : width}
			height={responsive ? "100%" : height}
			viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
			preserveAspectRatio="xMidYMid meet"
			class={responsive ? "block max-w-full" : undefined}
			style="background-color: #fff"
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
					{showSvgLabels ? (
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
					) : null}
				</g>
			))}

			{gates.map((gate) => (
				<g>
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: ロジックゲートの SVG シンボルを framework 非依存の lib から注入 */}
					<g dangerouslySetInnerHTML={{ __html: getGateSymbolPath(gate) }} />
					{showSvgLabels ? (
						<text
							x={gate.x}
							y={gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15}
							font-size="12"
							text-anchor="middle"
							fill="black"
							font-weight="bold"
						>
							{gate.type}
						</text>
					) : null}
				</g>
			))}

			{outputs.map((output) => (
				<g>
					<circle cx={output.x} cy={output.y} r="4" fill="black" />
					{showSvgLabels ? (
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
					) : null}
				</g>
			))}
		</svg>
	);

	if (!(responsive || rasterTextOverlay)) {
		return circuit;
	}

	const labelStyle = (x: number, y: number, fontSize: number): string => {
		const left = responsive ? `${((x - viewport.x) / viewport.width) * 100}%` : `${x}px`;
		const top = responsive ? `${((y - viewport.y) / viewport.height) * 100}%` : `${y}px`;
		return `position:absolute;left:${left};top:${top};font-size:${fontSize}px;line-height:1;color:#000;transform:translate(-50%,-50%);white-space:nowrap`;
	};
	const wrapperStyle = responsive
		? `position:relative;width:100%;max-width:${viewport.width}px;aspect-ratio:${viewport.width}/${viewport.height};background:#fff`
		: `position:relative;width:${width}px;height:${height}px;background:#fff`;

	return (
		<div
			class={responsive ? "overflow-hidden rounded border border-gray-300" : undefined}
			style={wrapperStyle}
		>
			{circuit}
			{inputs.map((input) => (
				<span aria-hidden="true" style={labelStyle(input.x - 17, input.y, 14)}>
					{input.label}
				</span>
			))}
			{gates.map((gate) => (
				<span
					aria-hidden="true"
					style={`${labelStyle(gate.x, gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15, 12)};font-weight:700`}
				>
					{gate.type}
				</span>
			))}
			{outputs.map((output) => (
				<span aria-hidden="true" style={labelStyle(output.x + 17, output.y, 14)}>
					{output.label}
				</span>
			))}
		</div>
	);
}
