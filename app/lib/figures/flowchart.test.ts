import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { FlowchartEdge, FlowchartNode } from "../../types/index.ts";
import {
	buildEdgeRenderData,
	buildNodeRenderData,
	FLOWCHART_DEFAULTS,
	getEdgePoint,
	getNodeDimensions,
} from "./flowchart.ts";

describe("getNodeDimensions", () => {
	it("returns default process dimensions for a process node", () => {
		const node: FlowchartNode = { id: "n1", type: "process", label: "Step", x: 100, y: 100 };
		const { w, h } = getNodeDimensions(node);
		assert.equal(w, FLOWCHART_DEFAULTS.NODE_WIDTH);
		assert.equal(h, FLOWCHART_DEFAULTS.NODE_HEIGHT);
	});

	it("returns default decision dimensions for a decision node", () => {
		const node: FlowchartNode = { id: "n1", type: "decision", label: "?", x: 100, y: 100 };
		const { w, h } = getNodeDimensions(node);
		assert.equal(w, FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION);
		assert.equal(h, FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION);
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
		assert.equal(w, 200);
		assert.equal(h, 60);
	});
});

describe("getEdgePoint", () => {
	const node: FlowchartNode = { id: "n1", type: "process", label: "X", x: 100, y: 100 };

	it("returns the correct top edge point", () => {
		const point = getEdgePoint(node, "top");
		const { h } = getNodeDimensions(node);
		assert.deepEqual(point, { x: 100, y: 100 - h / 2 });
	});

	it("returns the correct bottom edge point", () => {
		const point = getEdgePoint(node, "bottom");
		const { h } = getNodeDimensions(node);
		assert.deepEqual(point, { x: 100, y: 100 + h / 2 });
	});

	it("returns the correct left edge point", () => {
		const point = getEdgePoint(node, "left");
		const { w } = getNodeDimensions(node);
		assert.deepEqual(point, { x: 100 - w / 2, y: 100 });
	});

	it("returns the correct right edge point", () => {
		const point = getEdgePoint(node, "right");
		const { w } = getNodeDimensions(node);
		assert.deepEqual(point, { x: 100 + w / 2, y: 100 });
	});
});

describe("buildNodeRenderData", () => {
	it("includes points property for decision nodes", () => {
		const nodes: FlowchartNode[] = [{ id: "d1", type: "decision", label: "?", x: 100, y: 100 }];
		const result = buildNodeRenderData(nodes);
		assert.ok(result[0].points !== undefined);
		assert.ok((result[0].points).includes("100,"));
	});

	it("includes rx and ry for start/end nodes", () => {
		const nodes: FlowchartNode[] = [
			{ id: "s1", type: "start", label: "Start", x: 100, y: 50 },
			{ id: "e1", type: "end", label: "End", x: 100, y: 300 },
		];
		const result = buildNodeRenderData(nodes);
		assert.ok(result[0].rx !== undefined);
		assert.ok(result[0].ry !== undefined);
		assert.ok(result[1].rx !== undefined);
		assert.ok(result[1].ry !== undefined);
	});

	it("does not include points, rx, or ry for process nodes", () => {
		const nodes: FlowchartNode[] = [{ id: "p1", type: "process", label: "Do", x: 100, y: 100 }];
		const result = buildNodeRenderData(nodes);
		assert.equal(result[0].points, undefined);
		assert.equal(result[0].rx, undefined);
		assert.equal(result[0].ry, undefined);
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

		assert.equal((result).length, 1);
		assert.match(result[0].pathD, /^M .+ L .+$/);
	});

	it("includes the label in the render data", () => {
		const edges: FlowchartEdge[] = [{ from: "n1", to: "n2", label: "yes" }];
		const result = buildEdgeRenderData(nodes, edges);
		assert.equal(result[0].label, "yes");
	});

	it("skips edges with unknown node ids", () => {
		const edges: FlowchartEdge[] = [{ from: "n1", to: "unknown" }];
		const result = buildEdgeRenderData(nodes, edges);
		assert.equal((result).length, 0);
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
		assert.ok((result[0].pathD).includes("150 100"));
		// When points exist, label position uses the first waypoint
		assert.equal(result[0].labelX, 150);
		assert.equal(result[0].labelY, 100);
	});
});
