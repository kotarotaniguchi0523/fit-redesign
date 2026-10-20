import { describe, expect, it } from "vitest";
import type { StateNode, Transition } from "../../types";
import {
	buildTransitionData,
	getArrowHead,
	getArrowPath,
	getLabelPosition,
	type Point,
} from "./state-diagram";

describe("getArrowPath", () => {
	it("returns a straight line path when curveOffset is 0", () => {
		const path = getArrowPath({ x: 10, y: 20 }, { x: 100, y: 200 }, 0);
		expect(path).toBe("M 10 20 L 100 200");
	});

	it("returns a straight line path when curveOffset is omitted", () => {
		const path = getArrowPath({ x: 0, y: 0 }, { x: 50, y: 50 });
		expect(path).toBe("M 0 0 L 50 50");
	});

	it("returns a quadratic bezier path with a perpendicular control point when curveOffset is non-zero", () => {
		// Arrange
		const from = { x: 0, y: 0 };
		const to = { x: 100, y: 0 };
		const curveOffset = 30;

		// Act
		const path = getArrowPath(from, to, curveOffset);

		// Assert: control point sits at (midX, midY + offset) = (50, 30) for a horizontal edge
		expect(path).toBe("M 0 0 Q 50 30 100 0");
	});
});

describe("getLabelPosition", () => {
	it("returns midpoint for a straight line (curveOffset=0)", () => {
		const pos = getLabelPosition({ x: 0, y: 0 }, { x: 100, y: 200 }, 0);
		expect(pos.x).toBe(50);
		expect(pos.y).toBe(100 - 5); // midY - 5
	});

	it("returns the perpendicular-offset midpoint (minus 5) for a curved line", () => {
		// Arrange
		const from = { x: 0, y: 0 };
		const to = { x: 100, y: 0 };
		const curveOffset = 30;

		// Act
		const pos = getLabelPosition(from, to, curveOffset);

		// Assert: midpoint (50, 0) shifted by +30 along the perpendicular, then -5 in y => (50, 25)
		expect(pos).toEqual({ x: 50, y: 25 });
	});
});

describe("getArrowHead", () => {
	function parsePoints(path: string): Point[] {
		const numbers = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0]));
		// getArrowHead は 4 点（tipA, wing1, tipB, wing2）= 8 数値を返す。
		const indices = [0, 2, 4, 6];
		return indices.map((index) => ({ x: numbers[index], y: numbers[index + 1] }));
	}

	it("anchors the arrow head on the target node circle for a straight horizontal edge", () => {
		// Arrange
		const from = { x: 0, y: 0 };
		const to = { x: 100, y: 0 };
		const curveOffset = 0;
		const nodeRadius = 20;

		// Act
		const path = getArrowHead(from, to, curveOffset, nodeRadius);

		// Assert: tip pulled back by nodeRadius along the edge => (80, 0); wings symmetric in y
		expect(path).toMatch(/^M 80 0 L /);
		const [tipA, wing1, tipB, wing2] = parsePoints(path);
		expect(tipA).toEqual({ x: 80, y: 0 });
		expect(tipB).toEqual({ x: 80, y: 0 });
		expect(wing1.x).toBeCloseTo(74.803_847_577, 6);
		expect(wing1.y).toBeCloseTo(3, 6);
		expect(wing2.x).toBeCloseTo(74.803_847_577, 6);
		expect(wing2.y).toBeCloseTo(-3, 6);
	});

	it("offsets the tip by the supplied nodeRadius", () => {
		// Arrange
		const from = { x: 0, y: 0 };
		const to = { x: 100, y: 0 };
		const curveOffset = 0;
		const nodeRadius = 10;

		// Act
		const path = getArrowHead(from, to, curveOffset, nodeRadius);

		// Assert: tip pulled back by 10 instead of 20 => (90, 0)
		expect(path).toMatch(/^M 90 0 L /);
		const [tip] = parsePoints(path);
		expect(tip).toEqual({ x: 90, y: 0 });
	});

	it("takes the curved branch: the head angle follows the control point, not the straight edge", () => {
		// Arrange
		const from = { x: 0, y: 0 };
		const to = { x: 100, y: 0 };
		const nodeRadius = 20;

		// Act
		const straight = getArrowHead(from, to, 0, nodeRadius);
		const curved = getArrowHead(from, to, 30, nodeRadius);

		// Assert: straight tip is (80,0); curved tip is angled, so it differs in both axes
		const [straightTip] = parsePoints(straight);
		const [curvedTip] = parsePoints(curved);
		expect(straightTip).toEqual({ x: 80, y: 0 });
		expect(curvedTip.x).not.toBe(straightTip.x);
		expect(curvedTip.y).not.toBe(straightTip.y);
	});
});

describe("buildTransitionData", () => {
	const nodes: StateNode[] = [
		{ id: "q0", label: "q0", x: 50, y: 100 },
		{ id: "q1", label: "q1", x: 200, y: 100 },
	];

	it("handles normal transitions between different nodes", () => {
		const transitions: Transition[] = [{ from: "q0", to: "q1", label: "a" }];
		const result = buildTransitionData(nodes, transitions);

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("normal");
		expect(result[0].label).toBe("a");
		expect(result[0].pathD).toBeDefined();
		expect(result[0].arrowHeadD).toBeDefined();
		expect(result[0].labelX).toBeDefined();
		expect(result[0].labelY).toBeDefined();
	});

	it("handles self-loop transitions", () => {
		const transitions: Transition[] = [{ from: "q0", to: "q0", label: "b" }];
		const result = buildTransitionData(nodes, transitions);

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("selfLoop");
		expect(result[0].label).toBe("b");
		expect(result[0].cx).toBeDefined();
		expect(result[0].cy).toBeDefined();
		expect(result[0].r).toBeDefined();
		expect(result[0].arrowD).toBeDefined();
	});

	it("skips transitions with unknown node ids", () => {
		const transitions: Transition[] = [{ from: "q0", to: "q99", label: "x" }];
		const result = buildTransitionData(nodes, transitions);
		expect(result).toHaveLength(0);
	});

	it("handles multiple transitions including mixed types", () => {
		const transitions: Transition[] = [
			{ from: "q0", to: "q1", label: "a" },
			{ from: "q1", to: "q1", label: "b" },
			{ from: "q1", to: "q0", label: "c", curveOffset: 20 },
		];
		const result = buildTransitionData(nodes, transitions);

		expect(result).toHaveLength(3);
		expect(result[0].type).toBe("normal");
		expect(result[1].type).toBe("selfLoop");
		expect(result[2].type).toBe("normal");
	});

	it("self-loop position accounts for accepting node radius", () => {
		const acceptingNodes: StateNode[] = [
			{ id: "q0", label: "q0", x: 50, y: 100, isAccepting: true },
		];
		const transitions: Transition[] = [{ from: "q0", to: "q0", label: "a" }];

		const normalResult = buildTransitionData(nodes, transitions);
		const acceptingResult = buildTransitionData(acceptingNodes, transitions);

		// self-loop は cy を必ず持つ。未定義ならテスト失敗（ガードで黙ってスキップしない）。
		const normalCy = normalResult[0].cy;
		const acceptingCy = acceptingResult[0].cy;
		if (normalCy === undefined || acceptingCy === undefined) {
			throw new Error("self-loop transition は cy を定義しているはず");
		}
		// Accepting node self-loop should be positioned higher (further from node center).
		expect(acceptingCy).toBeLessThan(normalCy);
	});
});
