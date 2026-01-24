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

// 汎用テーブルの型定義
export interface DataTableColumn {
	key: string;
	label: string;
}

export interface DataTableRow {
	[key: string]: string | number;
}

// ハフマン符号表の型定義
export interface HuffmanTableData {
	characters: string[];
	probabilities: number[];
}

// リンクリスト（ポインタ）表の型定義
export interface LinkedListEntry {
	address: string | number;
	data: string;
	pointer: string | number;
}

// 正規分布表の型定義
export interface NormalDistributionEntry {
	u: number;
	probability: number;
}
