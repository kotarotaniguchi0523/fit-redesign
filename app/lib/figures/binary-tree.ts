import type { TreeNode } from "../../types";

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
	if (!node) {
		return 0;
	}
	return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
}

export function calculatePositions(
	root: TreeNode,
	width: number,
	height: number,
	nodeRadius: number,
): NodePosition[] {
	const depth = getTreeDepth(root);

	const walk = (
		node: TreeNode | undefined,
		level: number,
		left: number,
		right: number,
	): NodePosition[] => {
		if (!node) {
			return [];
		}

		const x = node.x === undefined ? (left + right) / 2 : node.x;
		const y = node.y === undefined ? ((level + 1) / (depth + 1)) * height : node.y;
		const current = { x, y, node };
		const leftPositions = node.left ? walk(node.left, level + 1, left, x) : [];
		const rightPositions = node.right ? walk(node.right, level + 1, x, right) : [];

		return [current, ...leftPositions, ...rightPositions];
	};

	return walk(root, 0, nodeRadius * 2, width - nodeRadius * 2);
}

export function getEdgeLines(positions: NodePosition[], nodeRadius: number): EdgeLine[] {
	const positionMap = new Map(positions.map((pos) => [pos.node, pos]));

	const collectEdges = (
		node: TreeNode | undefined,
		parentPos: NodePosition | null,
	): Array<{ from: NodePosition; to: NodePosition }> => {
		if (!(node && parentPos)) {
			return [];
		}

		const currentPos = positionMap.get(node);
		if (!currentPos) {
			return [];
		}

		const childEdges = [
			...(node.left ? collectEdges(node.left, currentPos) : []),
			...(node.right ? collectEdges(node.right, currentPos) : []),
		];

		return [{ from: parentPos, to: currentPos }, ...childEdges];
	};

	const root = positions[0]?.node;
	const rootPos = root ? positionMap.get(root) : undefined;
	const edges =
		root && rootPos
			? [
					...(root.left ? collectEdges(root.left, rootPos) : []),
					...(root.right ? collectEdges(root.right, rootPos) : []),
				]
			: [];

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
