import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TreeNode } from "../../types/index.ts";
import { calculatePositions, getEdgeLines, getTreeDepth } from "./binary-tree.ts";

describe("getTreeDepth", () => {
	it("returns 0 for an empty tree (undefined)", () => {
		assert.equal(getTreeDepth(undefined), 0);
	});

	it("returns 1 for a single node", () => {
		const node: TreeNode = { value: "A" };
		assert.equal(getTreeDepth(node), 1);
	});

	it("returns correct depth for a balanced tree", () => {
		const tree: TreeNode = {
			value: "A",
			left: {
				value: "B",
				left: { value: "D" },
				right: { value: "E" },
			},
			right: {
				value: "C",
				left: { value: "F" },
				right: { value: "G" },
			},
		};
		assert.equal(getTreeDepth(tree), 3);
	});

	it("returns correct depth for a left-skewed tree", () => {
		const tree: TreeNode = {
			value: "A",
			left: {
				value: "B",
				left: { value: "C" },
			},
		};
		assert.equal(getTreeDepth(tree), 3);
	});
});

describe("calculatePositions", () => {
	it("produces a single position for a single-node tree", () => {
		const root: TreeNode = { value: "A" };
		const positions = calculatePositions(root, 400, 200, 20);
		assert.equal((positions).length, 1);
	});

	it("centers the single node horizontally", () => {
		const root: TreeNode = { value: "A" };
		const width = 400;
		const nodeRadius = 20;
		const positions = calculatePositions(root, width, 200, nodeRadius);
		// Single node: midpoint between (nodeRadius*2) and (width - nodeRadius*2)
		const expectedX = (nodeRadius * 2 + (width - nodeRadius * 2)) / 2;
		assert.equal(positions[0].x, expectedX);
	});

	it("produces correct number of positions for a tree with children", () => {
		const root: TreeNode = {
			value: "A",
			left: { value: "B" },
			right: { value: "C" },
		};
		const positions = calculatePositions(root, 400, 200, 20);
		assert.equal((positions).length, 3);
	});

	it("uses explicit x/y coordinates when provided on nodes", () => {
		const root: TreeNode = { value: "A", x: 100, y: 50 };
		const positions = calculatePositions(root, 400, 200, 20);
		assert.equal(positions[0].x, 100);
		assert.equal(positions[0].y, 50);
	});
});

describe("getEdgeLines", () => {
	it("returns empty array for a single-node tree (no edges)", () => {
		const root: TreeNode = { value: "A" };
		const positions = calculatePositions(root, 400, 200, 20);
		const edges = getEdgeLines(positions, 20);
		assert.equal((edges).length, 0);
	});

	it("returns correct number of edges for a tree with children", () => {
		const root: TreeNode = {
			value: "A",
			left: { value: "B" },
			right: { value: "C" },
		};
		const positions = calculatePositions(root, 400, 200, 20);
		const edges = getEdgeLines(positions, 20);
		assert.equal((edges).length, 2);
	});

	it("shortens edge lines by nodeRadius on both ends", () => {
		const nodeRadius = 20;
		const root: TreeNode = {
			value: "A",
			left: { value: "B" },
		};
		const positions = calculatePositions(root, 400, 200, nodeRadius);
		const edges = getEdgeLines(positions, nodeRadius);

		const parentPos = positions[0];
		const childPos = positions[1];

		// The edge should NOT start at the exact parent position
		// because it is shortened by nodeRadius
		const dx = childPos.x - parentPos.x;
		const dy = childPos.y - parentPos.y;
		const fullDist = Math.sqrt(dx * dx + dy * dy);
		const edgeDx = edges[0].x2 - edges[0].x1;
		const edgeDy = edges[0].y2 - edges[0].y1;
		const edgeDist = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

		// Edge length should be approximately fullDist - 2 * nodeRadius
		assert.ok(Math.abs((edgeDist) - (fullDist - 2 * nodeRadius)) < 1e-6);
	});
});
