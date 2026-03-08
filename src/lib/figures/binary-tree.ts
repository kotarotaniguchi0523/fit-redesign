import type { TreeNode } from "../../types/index";

export interface NodePosition {
	x: number;
	y: number;
	node: TreeNode;
}

export interface EdgeLine {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export function getTreeDepth(node: TreeNode | undefined): number {
	if (!node) return 0;
	return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
}

export function calculatePositions(
	root: TreeNode,
	width: number,
	height: number,
	nodeRadius: number,
): NodePosition[] {
	const depth = getTreeDepth(root);
	const positions: NodePosition[] = [];

	const walk = (node: TreeNode | undefined, level: number, left: number, right: number) => {
		if (!node) return;

		const x = node.x !== undefined ? node.x : (left + right) / 2;
		const y = node.y !== undefined ? node.y : ((level + 1) / (depth + 1)) * height;

		positions.push({ x, y, node });

		if (node.left) {
			walk(node.left, level + 1, left, x);
		}
		if (node.right) {
			walk(node.right, level + 1, x, right);
		}
	};

	walk(root, 0, nodeRadius * 2, width - nodeRadius * 2);
	return positions;
}

export function getEdgeLines(positions: NodePosition[], nodeRadius: number): EdgeLine[] {
	const positionMap = new Map<TreeNode, NodePosition>();
	for (const pos of positions) {
		positionMap.set(pos.node, pos);
	}

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

	const root = positions[0]?.node;
	const rootPos = root ? positionMap.get(root) : undefined;
	if (root && rootPos) {
		if (root.left) {
			collectEdges(root.left, rootPos);
		}
		if (root.right) {
			collectEdges(root.right, rootPos);
		}
	}

	return edges.map((edge) => {
		const dx = edge.to.x - edge.from.x;
		const dy = edge.to.y - edge.from.y;
		const angle = Math.atan2(dy, dx);
		return {
			x1: edge.from.x + nodeRadius * Math.cos(angle),
			y1: edge.from.y + nodeRadius * Math.sin(angle),
			x2: edge.to.x - nodeRadius * Math.cos(angle),
			y2: edge.to.y - nodeRadius * Math.sin(angle),
		};
	});
}
