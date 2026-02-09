import type { StateNode, Transition } from "../../types/index";

export interface StateDiagramProps {
	nodes: StateNode[];
	transitions: Transition[];
	width?: number;
	height?: number;
}

export function StateDiagram({ nodes, transitions, width = 400, height = 150 }: StateDiagramProps) {
	const nodeRadius = 20;
	const acceptingNodeRadius = 25;

	// ノードIDから座標を取得するヘルパー用のMapを作成
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const getNode = (id: string) => nodeMap.get(id);

	return (
		<svg
			width="100%"
			height="auto"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			className="border border-gray-300 rounded max-w-full h-auto"
			style={{ aspectRatio: `${width}/${height}` }}
			aria-label="State machine diagram"
		>
			<title>State machine diagram</title>
			{/* 矢印マーカーの定義 (Used for initial state arrow) */}
			<defs>
				<marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
					<polygon points="0 0, 6 3, 0 6" fill="black" />
				</marker>
			</defs>

			{/* 遷移を描画 */}
			{transitions.map((transition) => {
				const fromNode = getNode(transition.from);
				const toNode = getNode(transition.to);

				if (!fromNode || !toNode) return null;

				const fromR = fromNode.isAccepting ? acceptingNodeRadius : nodeRadius;
				const toR = toNode.isAccepting ? acceptingNodeRadius : nodeRadius;

				// 自己ループの処理
				if (transition.from === transition.to) {
					const cx = fromNode.x;
					const cy = fromNode.y - fromR - 15;
					const r = 15;

					return (
						<g key={`transition-${transition.from}-${transition.to}-${transition.label}`}>
							{/* 自己ループの円 */}
							<circle cx={cx} cy={cy} r={r} fill="none" stroke="black" strokeWidth="1.5" />
							{/* 矢印 */}
							<path
								d={`M ${cx + r * 0.7} ${cy - r * 0.7} l 3 -3 M ${cx + r * 0.7} ${cy - r * 0.7} l 3 3`}
								stroke="black"
								strokeWidth="1.5"
								fill="none"
							/>
							{/* ラベル */}
							<text x={cx} y={cy - r - 5} fontSize="12" textAnchor="middle" fill="black">
								{transition.label}
							</text>
						</g>
					);
				}

				const curveOffset = transition.curveOffset || 0;
				let startX: number;
				let startY: number;
				let endX: number;
				let endY: number;
				let controlX: number;
				let controlY: number;
				let arrowAngle: number;

				if (curveOffset === 0) {
					const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
					startX = fromNode.x + fromR * Math.cos(angle);
					startY = fromNode.y + fromR * Math.sin(angle);
					endX = toNode.x - toR * Math.cos(angle);
					endY = toNode.y - toR * Math.sin(angle);

					// Linear path
					controlX = (startX + endX) / 2;
					controlY = (startY + endY) / 2;
					arrowAngle = angle;
				} else {
					// Quadratic Bezier Curve
					// Calculate Control Point based on node CENTERS
					const midX = (fromNode.x + toNode.x) / 2;
					const midY = (fromNode.y + toNode.y) / 2;
					const dx = toNode.x - fromNode.x;
					const dy = toNode.y - fromNode.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					const perpX = -dy / dist;
					const perpY = dx / dist;

					controlX = midX + perpX * curveOffset;
					controlY = midY + perpY * curveOffset;

					// Calculate Intersection with From Node (towards Control Point)
					const angleFrom = Math.atan2(controlY - fromNode.y, controlX - fromNode.x);
					startX = fromNode.x + fromR * Math.cos(angleFrom);
					startY = fromNode.y + fromR * Math.sin(angleFrom);

					// Calculate Intersection with To Node (from Control Point direction)
					const angleTo = Math.atan2(controlY - toNode.y, controlX - toNode.x);
					endX = toNode.x + toR * Math.cos(angleTo);
					endY = toNode.y + toR * Math.sin(angleTo);

					// Arrow angle is tangent of curve at end point (Vector: Control -> End)
					arrowAngle = Math.atan2(endY - controlY, endX - controlX);
				}

				// Label Position
				// For Bezier, t=0.5 is usually good
				// P(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
				// t=0.5 => 0.25 P0 + 0.5 P1 + 0.25 P2
				const t = 0.5;
				const labelX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
				const labelY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY - 5;

				// Arrow Head
				const arrowSize = 6;
				const x1 = endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6);
				const y1 = endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6);
				const x2 = endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6);
				const y2 = endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6);

				return (
					<g key={`transition-${transition.from}-${transition.to}-${transition.label}`}>
						{/* 遷移パス */}
						<path
							d={
								curveOffset === 0
									? `M ${startX} ${startY} L ${endX} ${endY}`
									: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`
							}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
						/>
						{/* 矢印の先端 */}
						<path
							d={`M ${endX} ${endY} L ${x1} ${y1} M ${endX} ${endY} L ${x2} ${y2}`}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
						/>
						{/* ラベル */}
						<text x={labelX} y={labelY} fontSize="12" textAnchor="middle" fill="black">
							{transition.label}
						</text>
					</g>
				);
			})}

			{/* ノードを描画 */}
			{nodes.map((node) => (
				<g key={node.id}>
					{/* 受理状態の場合は二重丸 */}
					{node.isAccepting && (
						<circle
							cx={node.x}
							cy={node.y}
							r={acceptingNodeRadius}
							fill="none"
							stroke="black"
							strokeWidth="1.5"
						/>
					)}
					{/* ノード */}
					<circle
						cx={node.x}
						cy={node.y}
						r={nodeRadius}
						fill="white"
						stroke="black"
						strokeWidth="1.5"
					/>
					{/* ラベル */}
					<text
						x={node.x}
						y={node.y}
						fontSize="14"
						textAnchor="middle"
						dominantBaseline="middle"
						fill="black"
					>
						{node.label}
					</text>
					{/* 初期状態の矢印 */}
					{node.isInitial && (
						<path
							d={`M ${node.x - nodeRadius - 20} ${node.y} L ${node.x - nodeRadius} ${node.y}`}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
							markerEnd="url(#arrowhead)"
						/>
					)}
				</g>
			))}
		</svg>
	);
}
