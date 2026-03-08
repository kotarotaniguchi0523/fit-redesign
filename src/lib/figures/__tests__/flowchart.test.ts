import { describe, expect, it } from "vitest";
import type { FlowchartEdge, FlowchartNode } from "../../../types/index";
import {
	buildEdgeRenderData,
	buildNodeRenderData,
	FLOWCHART_DEFAULTS,
	getEdgePoint,
	getNodeDimensions,
} from "../flowchart";

describe("getNodeDimensions", () => {
	it("returns default process dimensions for a process node", () => {
		const node: FlowchartNode = { id: "n1", type: "process", label: "Step", x: 100, y: 100 };
		const { w, h } = getNodeDimensions(node);
		expect(w).toBe(FLOWCHART_DEFAULTS.NODE_WIDTH);
		expect(h).toBe(FLOWCHART_DEFAULTS.NODE_HEIGHT);
	});

	it("returns default decision dimensions for a decision node", () => {
		const node: FlowchartNode = { id: "n1", type: "decision", label: "?", x: 100, y: 100 };
		const { w, h } = getNodeDimensions(node);
		expect(w).toBe(FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION);
		expect(h).toBe(FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION);
	});

	it("uses custom width and height when provided", () => {
		const node: FlowchartNode = {
			id: "n1",
			type: "process",
			label: "Wide",
			x: 100,
			y: 100,
			width: 200,
			height: 60,
		};
		const { w, h } = getNodeDimensions(node);
		expect(w).toBe(200);
		expect(h).toBe(60);
	});
});

describe("getEdgePoint", () => {
	const node: FlowchartNode = { id: "n1", type: "process", label: "X", x: 100, y: 100 };

	it("returns the correct top edge point", () => {
		const point = getEdgePoint(node, "top");
		const { h } = getNodeDimensions(node);
		expect(point).toEqual({ x: 100, y: 100 - h / 2 });
	});

	it("returns the correct bottom edge point", () => {
		const point = getEdgePoint(node, "bottom");
		const { h } = getNodeDimensions(node);
		expect(point).toEqual({ x: 100, y: 100 + h / 2 });
	});

	it("returns the correct left edge point", () => {
		const point = getEdgePoint(node, "left");
		const { w } = getNodeDimensions(node);
		expect(point).toEqual({ x: 100 - w / 2, y: 100 });
	});

	it("returns the correct right edge point", () => {
		const point = getEdgePoint(node, "right");
		const { w } = getNodeDimensions(node);
		expect(point).toEqual({ x: 100 + w / 2, y: 100 });
	});
});

describe("buildNodeRenderData", () => {
	it("includes points property for decision nodes", () => {
		const nodes: FlowchartNode[] = [{ id: "d1", type: "decision", label: "?", x: 100, y: 100 }];
		const result = buildNodeRenderData(nodes);
		expect(result[0].points).toBeDefined();
		expect(result[0].points).toContain("100,");
	});

	it("includes rx and ry for start/end nodes", () => {
		const nodes: FlowchartNode[] = [
			{ id: "s1", type: "start", label: "Start", x: 100, y: 50 },
			{ id: "e1", type: "end", label: "End", x: 100, y: 300 },
		];
		const result = buildNodeRenderData(nodes);
		expect(result[0].rx).toBeDefined();
		expect(result[0].ry).toBeDefined();
		expect(result[1].rx).toBeDefined();
		expect(result[1].ry).toBeDefined();
	});

	it("does not include points, rx, or ry for process nodes", () => {
		const nodes: FlowchartNode[] = [{ id: "p1", type: "process", label: "Do", x: 100, y: 100 }];
		const result = buildNodeRenderData(nodes);
		expect(result[0].points).toBeUndefined();
		expect(result[0].rx).toBeUndefined();
		expect(result[0].ry).toBeUndefined();
	});
});

describe("buildEdgeRenderData", () => {
	const nodes: FlowchartNode[] = [
		{ id: "n1", type: "process", label: "A", x: 100, y: 50 },
		{ id: "n2", type: "process", label: "B", x: 100, y: 150 },
	];

	it("generates a correct path for a simple top-to-bottom edge", () => {
		const edges: FlowchartEdge[] = [{ from: "n1", to: "n2" }];
		const result = buildEdgeRenderData(nodes, edges);

		expect(result).toHaveLength(1);
		expect(result[0].pathD).toMatch(/^M .+ L .+$/);
	});

	it("includes the label in the render data", () => {
		const edges: FlowchartEdge[] = [{ from: "n1", to: "n2", label: "yes" }];
		const result = buildEdgeRenderData(nodes, edges);
		expect(result[0].label).toBe("yes");
	});

	it("skips edges with unknown node ids", () => {
		const edges: FlowchartEdge[] = [{ from: "n1", to: "unknown" }];
		const result = buildEdgeRenderData(nodes, edges);
		expect(result).toHaveLength(0);
	});

	it("uses waypoints when edge has points", () => {
		const edges: FlowchartEdge[] = [
			{
				from: "n1",
				to: "n2",
				points: [{ x: 150, y: 100 }],
			},
		];
		const result = buildEdgeRenderData(nodes, edges);
		expect(result[0].pathD).toContain("150 100");
		// When points exist, label position uses the first waypoint
		expect(result[0].labelX).toBe(150);
		expect(result[0].labelY).toBe(100);
	});
});
