import type { LogicGate, LogicInput, LogicOutput, LogicWire } from "../../types/index";

export interface LogicCircuitProps {
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
	// ゲートの描画サイズ
	const gateWidth = 50;
	const gateHeight = 40;

	// 要素の検索用マップを作成 (O(1) lookup)
	const elementMap = new Map<string, LogicInput | LogicGate | LogicOutput>();
	for (const input of inputs) elementMap.set(input.id, input);
	for (const gate of gates) elementMap.set(gate.id, gate);
	for (const output of outputs) elementMap.set(output.id, output);

	// ゲートのシンボルを描画する関数
	const renderGateSymbol = (gate: LogicGate) => {
		const { x, y, type } = gate;

		switch (type) {
			case "AND":
				return (
					<g>
						{/* AND gate body */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   L ${x} ${y - gateHeight / 2}
                   A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2}
                   L ${x - gateWidth / 2} ${y + gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
					</g>
				);

			case "OR":
				return (
					<g>
						{/* OR gate body */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2}
                   A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
					</g>
				);

			case "NOT":
				return (
					<g>
						{/* NOT gate triangle */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   L ${x + gateWidth / 3} ${y}
                   L ${x - gateWidth / 2} ${y + gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						{/* NOT gate bubble */}
						<circle
							cx={x + gateWidth / 3 + 5}
							cy={y}
							r="5"
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
					</g>
				);

			case "NAND":
				return (
					<g>
						{/* NAND gate (AND + bubble) */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   L ${x} ${y - gateHeight / 2}
                   A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2}
                   L ${x - gateWidth / 2} ${y + gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<circle cx={x + 5} cy={y} r="5" fill="white" stroke="black" strokeWidth="1.5" />
					</g>
				);

			case "NOR":
				return (
					<g>
						{/* NOR gate (OR + bubble) */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2}
                   A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<circle cx={x + 5} cy={y} r="5" fill="white" stroke="black" strokeWidth="1.5" />
					</g>
				);

			case "XOR":
				return (
					<g>
						{/* XOR gate (OR with extra arc) */}
						<path
							d={`M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2}
                   A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						{/* Extra arc for XOR */}
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}`}
							fill="none"
							stroke="black"
							strokeWidth="1.5"
						/>
					</g>
				);

			case "XNOR":
				return (
					<g>
						{/* XNOR gate (XOR + bubble) */}
						<path
							d={`M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2}
                   A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2}
                   Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<path
							d={`M ${x - gateWidth / 2} ${y - gateHeight / 2}
                   Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}`}
							fill="none"
							stroke="black"
							strokeWidth="1.5"
						/>
						<circle cx={x + 10} cy={y} r="5" fill="white" stroke="black" strokeWidth="1.5" />
					</g>
				);

			default:
				return null;
		}
	};

	// ゲート名のラベルを描画
	const renderGateLabel = (gate: LogicGate) => {
		return (
			<text
				x={gate.x}
				y={gate.y + gateHeight / 2 + 15}
				fontSize="10"
				textAnchor="middle"
				fill="black"
				fontWeight="bold"
			>
				{gate.type}
			</text>
		);
	};

	// ワイヤーを描画する関数
	const renderWire = (wire: LogicWire) => {
		// 開始点と終了点の座標を取得
		const fromElement = elementMap.get(wire.from);
		const toElement = elementMap.get(wire.to);

		if (!fromElement || !toElement) return null;

		let startX: number;
		let startY: number;
		let endX: number;
		let endY: number;

		// 開始点の座標
		if ("label" in fromElement && inputs.includes(fromElement as LogicInput)) {
			// 入力ノードから
			startX = fromElement.x + 20;
			startY = fromElement.y;
		} else {
			// ゲートから
			const gate = fromElement as LogicGate;
			startX = gate.x + gateWidth / 2;
			startY = gate.y;
		}

		// 終了点の座標
		if ("label" in toElement && outputs.includes(toElement as LogicOutput)) {
			// 出力ノードへ
			endX = toElement.x - 20;
			endY = toElement.y;
		} else {
			// ゲートへ
			const gate = toElement as LogicGate;
			endX = gate.x - gateWidth / 2;
			endY = gate.y;
		}

		// ワイヤーのパス
		let pathData: string;
		if (wire.points && wire.points.length > 0) {
			// 曲がり角が指定されている場合
			pathData = `M ${startX} ${startY}`;
			for (const point of wire.points) {
				pathData += ` L ${point.x} ${point.y}`;
			}
			pathData += ` L ${endX} ${endY}`;
		} else {
			// 直線
			pathData = `M ${startX} ${startY} L ${endX} ${endY}`;
		}

		return <path d={pathData} stroke="black" strokeWidth="1.5" fill="none" />;
	};

	return (
		<svg
			width="100%"
			height="auto"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			className="border border-gray-300 rounded max-w-full"
			style={{ aspectRatio: `${width}/${height}` }}
			aria-label="Logic circuit diagram"
		>
			<title>Logic circuit diagram</title>

			{/* ワイヤーを描画（ゲートの下に描画） */}
			{wires.map((wire) => (
				<g key={`wire-${wire.from}-${wire.to}`}>{renderWire(wire)}</g>
			))}

			{/* 入力ノードを描画 */}
			{inputs.map((input) => (
				<g key={input.id}>
					{/* 入力端子 */}
					<circle cx={input.x} cy={input.y} r="4" fill="black" />
					{/* 入力ラベル */}
					<text
						x={input.x - 10}
						y={input.y}
						fontSize="14"
						textAnchor="end"
						dominantBaseline="middle"
						fill="black"
					>
						{input.label}
					</text>
				</g>
			))}

			{/* ゲートを描画 */}
			{gates.map((gate) => (
				<g key={gate.id}>
					{renderGateSymbol(gate)}
					{renderGateLabel(gate)}
				</g>
			))}

			{/* 出力ノードを描画 */}
			{outputs.map((output) => (
				<g key={output.id}>
					{/* 出力端子 */}
					<circle cx={output.x} cy={output.y} r="4" fill="black" />
					{/* 出力ラベル */}
					<text
						x={output.x + 10}
						y={output.y}
						fontSize="14"
						textAnchor="start"
						dominantBaseline="middle"
						fill="black"
					>
						{output.label}
					</text>
				</g>
			))}
		</svg>
	);
}
