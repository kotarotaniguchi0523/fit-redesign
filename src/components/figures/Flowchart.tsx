import type { FlowchartEdge, FlowchartNode } from "../../types";

const FLOWCHART_DEFAULTS = {
	WIDTH: 300,
	HEIGHT: 400,
	NODE_WIDTH: 100,
	NODE_WIDTH_DECISION: 80,
	NODE_HEIGHT: 30,
	NODE_HEIGHT_DECISION: 40,
} as const;

export interface FlowchartProps {
	nodes: FlowchartNode[];
	edges: FlowchartEdge[];
	width?: number;
	height?: number;
}

/**
 * フローチャートコンポーネント
 * アルゴリズムの流れを視覚化するためのSVG描画
 */
export function Flowchart({
	nodes,
	edges,
	width = FLOWCHART_DEFAULTS.WIDTH,
	height = FLOWCHART_DEFAULTS.HEIGHT,
}: FlowchartProps) {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	// ノードの描画
	const renderNode = (node: FlowchartNode) => {
		const defaultWidth =
			node.type === "decision"
				? FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION
				: FLOWCHART_DEFAULTS.NODE_WIDTH;
		const defaultHeight =
			node.type === "decision"
				? FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION
				: FLOWCHART_DEFAULTS.NODE_HEIGHT;
		const w = node.width ?? defaultWidth;
		const h = node.height ?? defaultHeight;

		switch (node.type) {
			case "start":
			case "end":
				// 角丸長方形
				return (
					<g key={node.id}>
						<rect
							x={node.x - w / 2}
							y={node.y - h / 2}
							width={w}
							height={h}
							rx={h / 2}
							ry={h / 2}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<text
							x={node.x}
							y={node.y}
							textAnchor="middle"
							dominantBaseline="middle"
							fontSize="12"
							fill="black"
						>
							{node.label}
						</text>
					</g>
				);

			case "process":
				// 四角形
				return (
					<g key={node.id}>
						<rect
							x={node.x - w / 2}
							y={node.y - h / 2}
							width={w}
							height={h}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<text
							x={node.x}
							y={node.y}
							textAnchor="middle"
							dominantBaseline="middle"
							fontSize="11"
							fill="black"
						>
							{node.label}
						</text>
					</g>
				);

			case "decision":
				// ひし形
				return (
					<g key={node.id}>
						<polygon
							points={`${node.x},${node.y - h / 2} ${node.x + w / 2},${node.y} ${node.x},${node.y + h / 2} ${node.x - w / 2},${node.y}`}
							fill="white"
							stroke="black"
							strokeWidth="1.5"
						/>
						<text
							x={node.x}
							y={node.y}
							textAnchor="middle"
							dominantBaseline="middle"
							fontSize="11"
							fill="black"
						>
							{node.label}
						</text>
					</g>
				);

			case "connector":
				// 小さな円
				return (
					<g key={node.id}>
						<circle cx={node.x} cy={node.y} r={8} fill="white" stroke="black" strokeWidth="1.5" />
					</g>
				);

			default:
				return null;
		}
	};

	// エッジの端点座標を計算
	const getEdgePoint = (
		node: FlowchartNode,
		side: "top" | "bottom" | "left" | "right",
	): { x: number; y: number } => {
		const w =
			node.width ??
			(node.type === "decision"
				? FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION
				: FLOWCHART_DEFAULTS.NODE_WIDTH);
		const h =
			node.height ??
			(node.type === "decision"
				? FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION
				: FLOWCHART_DEFAULTS.NODE_HEIGHT);

		switch (side) {
			case "top":
				return { x: node.x, y: node.y - h / 2 };
			case "bottom":
				return { x: node.x, y: node.y + h / 2 };
			case "left":
				return { x: node.x - w / 2, y: node.y };
			case "right":
				return { x: node.x + w / 2, y: node.y };
		}
	};

	// エッジの描画
	const renderEdge = (edge: FlowchartEdge, index: number) => {
		const fromNode = nodeMap.get(edge.from);
		const toNode = nodeMap.get(edge.to);

		if (!fromNode || !toNode) return null;

		const fromSide = edge.fromSide ?? "bottom";
		const toSide = edge.toSide ?? "top";

		const start = getEdgePoint(fromNode, fromSide);
		const end = getEdgePoint(toNode, toSide);

		// パスの構築
		let pathD: string;
		if (edge.points && edge.points.length > 0) {
			// 曲がり角がある場合
			const points = [start, ...edge.points, end];
			pathD = `M ${points[0].x} ${points[0].y}`;
			for (let i = 1; i < points.length; i++) {
				pathD += ` L ${points[i].x} ${points[i].y}`;
			}
		} else {
			// 直線
			pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
		}

		// ラベル位置の計算
		let labelX = (start.x + end.x) / 2;
		let labelY = (start.y + end.y) / 2;
		if (edge.points && edge.points.length > 0) {
			labelX = edge.points[0].x;
			labelY = edge.points[0].y;
		}

		return (
			<g key={`edge-${index}`}>
				<path
					d={pathD}
					fill="none"
					stroke="black"
					strokeWidth="1.5"
					markerEnd="url(#flowchart-arrow)"
				/>
				{edge.label && (
					<text x={labelX + 8} y={labelY - 4} fontSize="10" fill="black" fontWeight="bold">
						{edge.label}
					</text>
				)}
			</g>
		);
	};

	return (
		<svg
			width="100%"
			height="auto"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid meet"
			className="max-w-full h-auto"
			style={{ aspectRatio: `${width}/${height}` }}
			aria-label="Flowchart diagram"
		>
			<title>Flowchart diagram</title>

			{/* 矢印マーカーの定義 */}
			<defs>
				<marker
					id="flowchart-arrow"
					markerWidth="10"
					markerHeight="10"
					refX="9"
					refY="3"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<polygon points="0 0, 10 3, 0 6" fill="black" />
				</marker>
			</defs>

			{/* エッジを先に描画（ノードの下に） */}
			{edges.map((edge, index) => renderEdge(edge, index))}

			{/* ノードを描画 */}
			{nodes.map((node) => renderNode(node))}
		</svg>
	);
}
