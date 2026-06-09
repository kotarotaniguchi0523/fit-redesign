import type { StateNode, Transition } from "../../types";

export interface Point {
	x: number;
	y: number;
}

export const STATE_DEFAULTS = {
	NODE_RADIUS: 20,
	ACCEPTING_NODE_RADIUS: 25,
	ARROW_SIZE: 6,
	SELF_LOOP_RADIUS: 15,
} as const;

export function getArrowPath(from: Point, to: Point, curveOffset = 0): string {
	const { x: fromX, y: fromY } = from;
	const { x: toX, y: toY } = to;
	if (curveOffset === 0) {
		return `M ${fromX} ${fromY} L ${toX} ${toY}`;
	}
	const midX = (fromX + toX) / 2;
	const midY = (fromY + toY) / 2;
	const dx = toX - fromX;
	const dy = toY - fromY;
	const perpX = -dy;
	const perpY = dx;
	const length = Math.sqrt(perpX * perpX + perpY * perpY);
	const controlX = midX + (perpX / length) * curveOffset;
	const controlY = midY + (perpY / length) * curveOffset;
	return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
}

export function getArrowHead(
	from: Point,
	to: Point,
	curveOffset = 0,
	nodeRadius = STATE_DEFAULTS.NODE_RADIUS,
): string {
	const { x: fromX, y: fromY } = from;
	const { x: toX, y: toY } = to;
	const arrowSize = STATE_DEFAULTS.ARROW_SIZE;
	const angle =
		curveOffset === 0
			? Math.atan2(toY - fromY, toX - fromX)
			: (() => {
					const midX = (fromX + toX) / 2;
					const midY = (fromY + toY) / 2;
					const dx = toX - fromX;
					const dy = toY - fromY;
					const perpX = -dy;
					const perpY = dx;
					const length = Math.sqrt(perpX * perpX + perpY * perpY);
					const controlX = midX + (perpX / length) * curveOffset;
					const controlY = midY + (perpY / length) * curveOffset;
					return Math.atan2(toY - controlY, toX - controlX);
				})();

	const endX = toX - nodeRadius * Math.cos(angle);
	const endY = toY - nodeRadius * Math.sin(angle);

	const x1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
	const y1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
	const x2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
	const y2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);

	return `M ${endX} ${endY} L ${x1} ${y1} M ${endX} ${endY} L ${x2} ${y2}`;
}

export function getLabelPosition(from: Point, to: Point, curveOffset = 0): Point {
	const { x: fromX, y: fromY } = from;
	const { x: toX, y: toY } = to;
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
}

export interface TransitionRenderData {
	type: "selfLoop" | "normal";
	label: string;
	cx?: number;
	cy?: number;
	r?: number;
	arrowD?: string;
	labelX?: number;
	labelY?: number;
	pathD?: string;
	arrowHeadD?: string;
}

export function buildTransitionData(
	nodes: StateNode[],
	transitions: Transition[],
	nodeRadius = STATE_DEFAULTS.NODE_RADIUS,
	acceptingNodeRadius = STATE_DEFAULTS.ACCEPTING_NODE_RADIUS,
): TransitionRenderData[] {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	return transitions.flatMap((transition) => {
		const fromNode = nodeMap.get(transition.from);
		const toNode = nodeMap.get(transition.to);
		if (!(fromNode && toNode)) return [];

		if (transition.from === transition.to) {
			const radius = fromNode.isAccepting ? acceptingNodeRadius : nodeRadius;
			const cx = fromNode.x;
			const cy = fromNode.y - radius - STATE_DEFAULTS.SELF_LOOP_RADIUS;
			const r = STATE_DEFAULTS.SELF_LOOP_RADIUS;
			const renderData: TransitionRenderData = {
				type: "selfLoop",
				label: transition.label,
				cx,
				cy,
				r,
				arrowD: `M ${cx + r * 0.7} ${cy - r * 0.7} l 3 -3 M ${cx + r * 0.7} ${cy - r * 0.7} l 3 3`,
				labelX: cx,
				labelY: cy - r - 5,
			};
			return [renderData];
		}

		const curveOffset = transition.curveOffset || 0;
		const labelPos = getLabelPosition(
			{ x: fromNode.x, y: fromNode.y },
			{ x: toNode.x, y: toNode.y },
			curveOffset,
		);
		const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
		const start =
			curveOffset === 0
				? {
						x: fromNode.x + nodeRadius * Math.cos(angle),
						y: fromNode.y + nodeRadius * Math.sin(angle),
					}
				: { x: fromNode.x, y: fromNode.y };
		const end =
			curveOffset === 0
				? {
						x: toNode.x - nodeRadius * Math.cos(angle),
						y: toNode.y - nodeRadius * Math.sin(angle),
					}
				: { x: toNode.x, y: toNode.y };

		return [
			{
				type: "normal",
				label: transition.label,
				pathD: getArrowPath(start, end, curveOffset),
				arrowHeadD: getArrowHead(start, end, curveOffset, nodeRadius),
				labelX: labelPos.x,
				labelY: labelPos.y,
			},
		];
	});
}
