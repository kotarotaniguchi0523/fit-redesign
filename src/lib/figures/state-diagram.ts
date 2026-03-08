import type { StateNode, Transition } from "../../types/index";

export const STATE_DEFAULTS = {
	NODE_RADIUS: 20,
	ACCEPTING_NODE_RADIUS: 25,
	ARROW_SIZE: 6,
	SELF_LOOP_RADIUS: 15,
} as const;

export function getArrowPath(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	curveOffset = 0,
): string {
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
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	curveOffset = 0,
	nodeRadius = STATE_DEFAULTS.NODE_RADIUS,
): string {
	const arrowSize = STATE_DEFAULTS.ARROW_SIZE;
	let angle: number;

	if (curveOffset === 0) {
		angle = Math.atan2(toY - fromY, toX - fromX);
	} else {
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const perpX = -dy;
		const perpY = dx;
		const length = Math.sqrt(perpX * perpX + perpY * perpY);
		const controlX = midX + (perpX / length) * curveOffset;
		const controlY = midY + (perpY / length) * curveOffset;
		angle = Math.atan2(toY - controlY, toX - controlX);
	}

	const endX = toX - nodeRadius * Math.cos(angle);
	const endY = toY - nodeRadius * Math.sin(angle);

	const x1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
	const y1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
	const x2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
	const y2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);

	return `M ${endX} ${endY} L ${x1} ${y1} M ${endX} ${endY} L ${x2} ${y2}`;
}

export function getLabelPosition(
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	curveOffset = 0,
): { x: number; y: number } {
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
	const result: TransitionRenderData[] = [];

	for (const transition of transitions) {
		const fromNode = nodeMap.get(transition.from);
		const toNode = nodeMap.get(transition.to);
		if (!fromNode || !toNode) continue;

		if (transition.from === transition.to) {
			const radius = fromNode.isAccepting ? acceptingNodeRadius : nodeRadius;
			const cx = fromNode.x;
			const cy = fromNode.y - radius - STATE_DEFAULTS.SELF_LOOP_RADIUS;
			const r = STATE_DEFAULTS.SELF_LOOP_RADIUS;
			result.push({
				type: "selfLoop",
				label: transition.label,
				cx,
				cy,
				r,
				arrowD: `M ${cx + r * 0.7} ${cy - r * 0.7} l 3 -3 M ${cx + r * 0.7} ${cy - r * 0.7} l 3 3`,
				labelX: cx,
				labelY: cy - r - 5,
			});
		} else {
			const curveOffset = transition.curveOffset || 0;
			const labelPos = getLabelPosition(fromNode.x, fromNode.y, toNode.x, toNode.y, curveOffset);
			const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
			let startX: number;
			let startY: number;
			let endX: number;
			let endY: number;

			if (curveOffset === 0) {
				startX = fromNode.x + nodeRadius * Math.cos(angle);
				startY = fromNode.y + nodeRadius * Math.sin(angle);
				endX = toNode.x - nodeRadius * Math.cos(angle);
				endY = toNode.y - nodeRadius * Math.sin(angle);
			} else {
				startX = fromNode.x;
				startY = fromNode.y;
				endX = toNode.x;
				endY = toNode.y;
			}

			result.push({
				type: "normal",
				label: transition.label,
				pathD: getArrowPath(startX, startY, endX, endY, curveOffset),
				arrowHeadD: getArrowHead(startX, startY, endX, endY, curveOffset, nodeRadius),
				labelX: labelPos.x,
				labelY: labelPos.y,
			});
		}
	}

	return result;
}
