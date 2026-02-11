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

	// 2点間の矢印を描画するパスを生成
	const getArrowPath = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		controlX?: number,
		controlY?: number,
	): string => {
		if (controlX === undefined || controlY === undefined) {
			// 直線の場合
			return `M ${fromX} ${fromY} L ${toX} ${toY}`;
		}
		return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
	};

	// 矢印の先端を描画
	const getArrowHead = (endX: number, endY: number, angle: number): string => {
		const arrowSize = 6;
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
					const r = 18;
					const cx = fromNode.x;
					const cy = fromNode.y - radius - r - 2; // 少し離す

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
				let startX: number;
				let startY: number;
				let endX: number;
				let endY: number;
				let controlX: number | undefined;
				let controlY: number | undefined;
				let arrowAngle: number;

				if (curveOffset === 0) {
					const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
					startX = fromNode.x + nodeRadius * Math.cos(angle);
					startY = fromNode.y + nodeRadius * Math.sin(angle);
					endX = toNode.x - nodeRadius * Math.cos(angle);
					endY = toNode.y - nodeRadius * Math.sin(angle);
					arrowAngle = angle;
				} else {
					// ベジェ曲線の制御点を計算
					const midX = (fromNode.x + toNode.x) / 2;
					const midY = (fromNode.y + toNode.y) / 2;
					const dx = toNode.x - fromNode.x;
					const dy = toNode.y - fromNode.y;
					const perpX = -dy;
					const perpY = dx;
					const length = Math.sqrt(perpX * perpX + perpY * perpY);
					controlX = midX + (perpX / length) * curveOffset;
					controlY = midY + (perpY / length) * curveOffset;

					// 始点: 中心から制御点に向かう方向で半径分移動
					const startAngle = Math.atan2(controlY - fromNode.y, controlX - fromNode.x);
					startX = fromNode.x + nodeRadius * Math.cos(startAngle);
					startY = fromNode.y + nodeRadius * Math.sin(startAngle);

					// 終点: 制御点から中心に向かう方向（接線）で半径分戻る（中心から制御点方向へ移動した点）
					// つまり、中心から制御点へのベクトルとの交点
					const endAngle = Math.atan2(controlY - toNode.y, controlX - toNode.x);
					endX = toNode.x + nodeRadius * Math.cos(endAngle);
					endY = toNode.y + nodeRadius * Math.sin(endAngle);

					// 矢印の角度は、終点から制御点への角度の逆（制御点から終点へ入ってくる角度）
					// 接線角度は endAngle と同じだと外向きになるので、逆方向（内向き）にする
					arrowAngle = Math.atan2(toNode.y - controlY, toNode.x - controlX);
				}

				return (
					<g key={`transition-${transition.from}-${transition.to}-${transition.label}`}>
						{/* 遷移パス */}
						<path
							d={getArrowPath(startX, startY, endX, endY, controlX, controlY)}
							stroke="black"
							strokeWidth="1.5"
							fill="none"
						/>
						{/* 矢印の先端 */}
						<path
							d={getArrowHead(endX, endY, arrowAngle)}
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
