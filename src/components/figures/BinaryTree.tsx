import type { TreeNode } from "../../types/figures";

export interface BinaryTreeProps {
	root: TreeNode;
	width?: number;
	height?: number;
	nodeRadius?: number;
}

interface NodePosition {
	x: number;
	y: number;
	node: TreeNode;
}

export function BinaryTree({ root, width = 300, height = 200, nodeRadius = 20 }: BinaryTreeProps) {
	// ツリーの深さを計算
	const getTreeDepth = (node: TreeNode | undefined): number => {
		if (!node) return 0;
		return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
	};

	const depth = getTreeDepth(root);

	// ノードの位置を計算
	const positions: NodePosition[] = [];

	const calculatePositions = (
		node: TreeNode | undefined,
		level: number,
		left: number,
		right: number,
	) => {
		if (!node) return;

		const x = (left + right) / 2;
		const y = ((level + 1) / (depth + 1)) * height;

		positions.push({ x, y, node });

		// 左の子ノード
		if (node.left) {
			calculatePositions(node.left, level + 1, left, x);
		}

		// 右の子ノード
		if (node.right) {
			calculatePositions(node.right, level + 1, x, right);
		}
	};

	calculatePositions(root, 0, nodeRadius * 2, width - nodeRadius * 2);

	// positions配列からMapを作成してO(1)の検索を可能にする
	const positionMap = new Map<TreeNode, NodePosition>();
	for (const pos of positions) {
		positionMap.set(pos.node, pos);
	}

	// エッジを描画するためのデータを準備
	const edges: Array<{ from: NodePosition; to: NodePosition }> = [];

	const collectEdges = (node: TreeNode | undefined, parentPos: NodePosition | null) => {
		if (!node || !parentPos) return;

		const currentPos = positionMap.get(node);
		if (!currentPos) return;

		edges.push({ from: parentPos, to: currentPos });

		if (node.left) {
			collectEdges(node.left, currentPos);
		}
		if (node.right) {
			collectEdges(node.right, currentPos);
		}
	};

	const rootPos = positionMap.get(root);
	if (rootPos) {
		if (root.left) {
			collectEdges(root.left, rootPos);
		}
		if (root.right) {
			collectEdges(root.right, rootPos);
		}
	}

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className="border border-gray-300 rounded"
			aria-label="Binary tree diagram"
		>
			<title>Binary tree diagram</title>
			{/* エッジを描画 */}
			{edges.map((edge) => {
				// ノードの縁から線を引くための計算
				const dx = edge.to.x - edge.from.x;
				const dy = edge.to.y - edge.from.y;
				const angle = Math.atan2(dy, dx);

				const startX = edge.from.x + nodeRadius * Math.cos(angle);
				const startY = edge.from.y + nodeRadius * Math.sin(angle);
				const endX = edge.to.x - nodeRadius * Math.cos(angle);
				const endY = edge.to.y - nodeRadius * Math.sin(angle);

				return (
					<line
						key={`edge-${edge.from.node.value}-${edge.to.node.value}`}
						x1={startX}
						y1={startY}
						x2={endX}
						y2={endY}
						stroke="black"
						strokeWidth="1.5"
					/>
				);
			})}

			{/* ノードを描画 */}
			{positions.map((pos) => (
				<g key={`node-${pos.node.value}`}>
					<circle
						cx={pos.x}
						cy={pos.y}
						r={nodeRadius}
						fill="white"
						stroke="black"
						strokeWidth="1.5"
					/>
					<text
						x={pos.x}
						y={pos.y}
						fontSize="14"
						textAnchor="middle"
						dominantBaseline="middle"
						fill="black"
					>
						{pos.node.value}
					</text>
				</g>
			))}
		</svg>
	);
}
