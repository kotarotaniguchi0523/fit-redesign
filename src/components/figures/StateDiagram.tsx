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

	// 制御点を計算するヘルパー
	const getControlPoint = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		offset: number,
	) => {
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const perpX = -dy;
		const perpY = dx;
		const length = Math.sqrt(perpX * perpX + perpY * perpY);
		if (length === 0) return { x: midX, y: midY };
		return {
			x: midX + (perpX / length) * offset,
			y: midY + (perpY / length) * offset,
		};
	};

	// 2点間の矢印を描画するパスを生成
	const getArrowPath = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		curveOffset = 0,
	): string => {
		if (curveOffset === 0) {
			return `M ${fromX} ${fromY} L ${toX} ${toY}`;
		}
		// 曲線の場合、渡された始点・終点を使って新しい制御点を計算する
		// ここでのcurveOffsetは、始点・終点間の距離に対する比率が変わるため、
		// 見た目を維持するために元のoffsetを使う（厳密には再計算が必要だが近似で良い）
		const cp = getControlPoint(fromX, fromY, toX, toY, curveOffset);
		return `M ${fromX} ${fromY} Q ${cp.x} ${cp.y} ${toX} ${toY}`;
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
			angle = Math.atan2(toY - fromY, toX - fromX);
		} else {
			// 曲線の場合は、終点直前の接線方向を計算する
			// Q (cp) -> to のベクトルが接線に近い
			const cp = getControlPoint(fromX, fromY, toX, toY, curveOffset);
			angle = Math.atan2(toY - cp.y, toX - cp.x);
		}

		// 既にエッジまで計算されているので、toX/toYが先端
		const endX = toX;
		const endY = toY;

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
		const cp = getControlPoint(fromX, fromY, toX, toY, curveOffset);
		// ベジェ曲線の頂点（t=0.5）は、中点と制御点の中点
		// Q(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
		// t=0.5 => 0.25 P0 + 0.5 P1 + 0.25 P2
		// Mid(P0, P2) = 0.5 P0 + 0.5 P2
		// CurveMid = 0.5 * Mid(P0, P2) + 0.5 * P1
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;

		return {
			x: (midX + cp.x) / 2,
			y: (midY + cp.y) / 2 - 5,
		};
	};

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
			{/* 遷移を描画 */}
			{transitions.map((transition) => {
				const fromNode = getNode(transition.from);
				const toNode = getNode(transition.to);

				if (!fromNode || !toNode) return null;

				// 自己ループの処理
				if (transition.from === transition.to) {
					const radius = fromNode.isAccepting ? acceptingNodeRadius : nodeRadius;
					const cx = fromNode.x;
					const cy = fromNode.y - radius - 15;
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

				if (curveOffset === 0) {
					const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
					startX = fromNode.x + nodeRadius * Math.cos(angle);
					startY = fromNode.y + nodeRadius * Math.sin(angle);
					endX = toNode.x - nodeRadius * Math.cos(angle);
					endY = toNode.y - nodeRadius * Math.sin(angle);
				} else {
					// ノード中心間の制御点を計算
					const cp = getControlPoint(fromNode.x, fromNode.y, toNode.x, toNode.y, curveOffset);

					// 始点：中心から制御点方向へ半径分移動
					const startAngle = Math.atan2(cp.y - fromNode.y, cp.x - fromNode.x);
					startX = fromNode.x + nodeRadius * Math.cos(startAngle);
					startY = fromNode.y + nodeRadius * Math.sin(startAngle);

					// 終点：中心から制御点方向へ半径分移動
					const endAngle = Math.atan2(cp.y - toNode.y, cp.x - toNode.x);
					endX = toNode.x + nodeRadius * Math.cos(endAngle);
					endY = toNode.y + nodeRadius * Math.sin(endAngle);
				}

				// ラベル位置（計算済みのエッジ座標を使うとより正確）
				const labelPos = getLabelPosition(startX, startY, endX, endY, curveOffset);

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
