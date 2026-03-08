import { describe, expect, it } from "vitest";
import type { StateNode, Transition } from "../../../types/index";
import { buildTransitionData, getArrowPath, getLabelPosition } from "../state-diagram";

describe("getArrowPath", () => {
	it("returns a straight line path when curveOffset is 0", () => {
		const path = getArrowPath(10, 20, 100, 200, 0);
		expect(path).toBe("M 10 20 L 100 200");
	});

	it("returns a straight line path when curveOffset is omitted", () => {
		const path = getArrowPath(0, 0, 50, 50);
		expect(path).toBe("M 0 0 L 50 50");
	});

	it("returns a quadratic bezier path when curveOffset is non-zero", () => {
		const path = getArrowPath(0, 0, 100, 0, 30);
		expect(path).toMatch(/^M 0 0 Q .+ 100 0$/);
		expect(path).not.toContain("L");
	});
});

describe("getLabelPosition", () => {
	it("returns midpoint for a straight line (curveOffset=0)", () => {
		const pos = getLabelPosition(0, 0, 100, 200, 0);
		expect(pos.x).toBe(50);
		expect(pos.y).toBe(100 - 5); // midY - 5
	});

	it("returns offset position for a curved line", () => {
		const straightPos = getLabelPosition(0, 0, 100, 0, 0);
		const curvedPos = getLabelPosition(0, 0, 100, 0, 30);
		// Curved label should be offset from the straight midpoint
		expect(curvedPos.y).not.toBe(straightPos.y);
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

		const normalResult = buildTransitionData(
			nodes,
			[transitions[0]].map((t) => ({ ...t })),
		);
		const acceptingResult = buildTransitionData(acceptingNodes, transitions);

		// Accepting node self-loop should be positioned higher (further from node center)
		if (normalResult[0].cy !== undefined && acceptingResult[0].cy !== undefined) {
			expect(acceptingResult[0].cy).toBeLessThan(normalResult[0].cy);
		}
	});
});
