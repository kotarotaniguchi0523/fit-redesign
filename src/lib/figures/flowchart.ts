import type { FlowchartEdge, FlowchartNode } from "../../types/index";

export const FLOWCHART_DEFAULTS = {
	WIDTH: 300,
	HEIGHT: 400,
	NODE_WIDTH: 100,
	NODE_WIDTH_DECISION: 80,
	NODE_HEIGHT: 30,
	NODE_HEIGHT_DECISION: 40,
} as const;

export function getNodeDimensions(node: FlowchartNode): { w: number; h: number } {
	const defaultWidth =
		node.type === "decision"
			? FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION
			: FLOWCHART_DEFAULTS.NODE_WIDTH;
	const defaultHeight =
		node.type === "decision"
			? FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION
			: FLOWCHART_DEFAULTS.NODE_HEIGHT;
	return {
		w: node.width ?? defaultWidth,
		h: node.height ?? defaultHeight,
	};
}

export function getEdgePoint(
	node: FlowchartNode,
	side: "top" | "bottom" | "left" | "right",
): { x: number; y: number } {
	const { w, h } = getNodeDimensions(node);
	switch (side) {
		case "top":
			return { x: node.x, y: node.y - h / 2 };
		case "bottom":
			return { x: node.x, y: node.y + h / 2 };
		case "left":
			return { x: node.x - w / 2, y: node.y };
		case "right":
			return { x: node.x + w / 2, y: node.y };
	}
}

export interface NodeRenderData {
	type: FlowchartNode["type"];
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	rx?: number;
	ry?: number;
	points?: string;
}

export function buildNodeRenderData(nodes: FlowchartNode[]): NodeRenderData[] {
	return nodes.map((node) => {
		const { w, h } = getNodeDimensions(node);
		const base = {
			type: node.type,
			id: node.id,
			x: node.x,
			y: node.y,
			w,
			h,
			label: node.label,
		};
		if (node.type === "decision") {
			return {
				...base,
				points: `${node.x},${node.y - h / 2} ${node.x + w / 2},${node.y} ${node.x},${node.y + h / 2} ${node.x - w / 2},${node.y}`,
			};
		}
		if (node.type === "start" || node.type === "end") {
			return { ...base, rx: h / 2, ry: h / 2 };
		}
		return base;
	});
}

export interface EdgeRenderData {
	pathD: string;
	label?: string;
	labelX: number;
	labelY: number;
}

export function buildEdgeRenderData(
	nodes: FlowchartNode[],
	edges: FlowchartEdge[],
): EdgeRenderData[] {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const result: EdgeRenderData[] = [];

	for (const edge of edges) {
		const fromNode = nodeMap.get(edge.from);
		const toNode = nodeMap.get(edge.to);
		if (!fromNode || !toNode) continue;

		const fromSide = edge.fromSide ?? "bottom";
		const toSide = edge.toSide ?? "top";
		const start = getEdgePoint(fromNode, fromSide);
		const end = getEdgePoint(toNode, toSide);

		let pathD: string;
		if (edge.points && edge.points.length > 0) {
			const points = [start, ...edge.points, end];
			pathD = `M ${points[0].x} ${points[0].y}`;
			for (let j = 1; j < points.length; j++) {
				pathD += ` L ${points[j].x} ${points[j].y}`;
			}
		} else {
			pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
		}

		let labelX = (start.x + end.x) / 2;
		let labelY = (start.y + end.y) / 2;
		if (edge.points && edge.points.length > 0) {
			labelX = edge.points[0].x;
			labelY = edge.points[0].y;
		}

		result.push({ pathD, label: edge.label, labelX, labelY });
	}

	return result;
}
