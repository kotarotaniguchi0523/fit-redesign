// 状態遷移図の型定義
export interface StateNode {
	id: string;
	label: string;
	x: number;
	y: number;
	isInitial?: boolean;
	isAccepting?: boolean;
}

export interface Transition {
	from: string;
	to: string;
	label: string;
	curveOffset?: number; // 曲線の場合のオフセット
}

// 二分木の型定義
export interface TreeNode {
	value: string | number;
	left?: TreeNode;
	right?: TreeNode;
}

// 真理値表の型定義
export interface TruthTableColumn {
	key: string;
	label: string;
}

export interface TruthTableRow {
	[key: string]: string | number | boolean;
}
