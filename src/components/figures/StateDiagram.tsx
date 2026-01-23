export interface StateNode {
	id: string;
	label: string;
	x: number;
	y: number;
	isInitial?: boolean;
	isAccepting?: boolean;
}

export interface Transition {
	from: string;
	to: string;
	label: string;
	curveOffset?: number; // 曲線の場合のオフセット
}

export interface StateDiagramProps {
	nodes: StateNode[];
	transitions: Transition[];
	width?: number;
	height?: number;
}

export function StateDiagram({ nodes, transitions, width = 400, height = 150 }: StateDiagramProps) {
	const nodeRadius = 20;
	const acceptingNodeRadius = 25;

	// ノードIDから座標を取得するヘルパー
	const getNode = (id: string) => nodes.find((n) => n.id === id);

	// 2点間の矢印を描画するパスを生成
	const getArrowPath = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		curveOffset = 0,
	): string => {
		if (curveOffset === 0) {
			// 直線の場合
			return `M ${fromX} ${fromY} L ${toX} ${toY}`;
		}
		// 曲線の場合（二次ベジェ曲線）
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const perpX = -dy;
		const perpY = dx;
		const length = Math.sqrt(perpX * perpX + perpY * perpY);
		const controlX = midX + (perpX / length) * curveOffset;
		const controlY = midY + (perpY / length) * curveOffset;
		return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
	};

	// 矢印の先端を描画
	const getArrowHead = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		curveOffset = 0,
	): string => {
		const arrowSize = 6;
		let angle: number;

		if (curveOffset === 0) {
			// 直線の場合
			angle = Math.atan2(toY - fromY, toX - fromX);
		} else {
			// 曲線の場合は終点付近の接線を計算
			const midX = (fromX + toX) / 2;
			const midY = (fromY + toY) / 2;
			const dx = toX - fromX;
			const dy = toY - fromY;
			const perpX = -dy;
			const perpY = dx;
			const length = Math.sqrt(perpX * perpX + perpY * perpY);
			const controlX = midX + (perpX / length) * curveOffset;
			const controlY = midY + (perpY / length) * curveOffset;
			angle = Math.atan2(toY - controlY, toX - controlX);
		}

		// ノードの縁で矢印を終わらせるための調整
		const endX = toX - nodeRadius * Math.cos(angle);
		const endY = toY - nodeRadius * Math.sin(angle);

		const x1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
		const y1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
		const x2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
		const y2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);

		return `M ${endX} ${endY} L ${x1} ${y1} M ${endX} ${endY} L ${x2} ${y2}`;
	};

	// ラベル位置を計算
	const getLabelPosition = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		curveOffset = 0,
	): { x: number; y: number } => {
		if (curveOffset === 0) {
			return {
				x: (fromX + toX) / 2,
				y: (fromY + toY) / 2 - 5,
			};
		}
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const perpX = -dy;
		const perpY = dx;
		const length = Math.sqrt(perpX * perpX + perpY * perpY);
		return {
			x: midX + (perpX / length) * curveOffset,
			y: midY + (perpY / length) * curveOffset - 5,
		};
	};

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className="border border-gray-300 rounded"
			aria-label="State machine diagram"
		>
			<title>State machine diagram</title>
			{/* 遷移を描画 */}
			{transitions.map((transition) => {
				const fromNode = getNode(transition.from);
				const toNode = getNode(transition.to);

				if (!fromNode || !toNode) return null;

				// 自己ループの処理
				if (transition.from === transition.to) {
					const cx = fromNode.x;
					const cy = fromNode.y - nodeRadius - 15;
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
				const labelPos = getLabelPosition(fromNode.x, fromNode.y, toNode.x, toNode.y, curveOffset);

				// ノードの縁から矢印を開始/終了するための調整
				const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
				let startX: number;
				let startY: number;
				let endX: number;
				let endY: number;

				if (curveOffset === 0) {
					startX = fromNode.x + nodeRadius * Math.cos(angle);
					startY = fromNode.y + nodeRadius * Math.sin(angle);
					endX = toNode.x - nodeRadius * Math.cos(angle);
					endY = toNode.y - nodeRadius * Math.sin(angle);
				} else {
					// 曲線の場合は始点と終点を調整
					startX = fromNode.x;
					startY = fromNode.y;
					endX = toNode.x;
					endY = toNode.y;
				}

				return (
					<g key={`transition-${transition.from}-${transition.to}-${transition.label}`}>
						{/* 遷移パス */}
						<path
							d={getArrowPath(startX, startY, endX, endY, curveOffset)}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
						/>
						{/* 矢印の先端 */}
						<path
							d={getArrowHead(startX, startY, endX, endY, curveOffset)}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
						/>
						{/* ラベル */}
						<text x={labelPos.x} y={labelPos.y} fontSize="12" textAnchor="middle" fill="black">
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

			{/* 矢印マーカーの定義 */}
			<defs>
				<marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto">
					<polygon points="0 0, 6 3, 0 6" fill="black" />
				</marker>
			</defs>
		</svg>
	);
}
