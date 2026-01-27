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

// 論理回路の型定義
export type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR";

export interface LogicGate {
	id: string;
	type: GateType;
	x: number;
	y: number;
}

export interface LogicInput {
	id: string;
	label: string;
	x: number;
	y: number;
}

export interface LogicOutput {
	id: string;
	label: string;
	x: number;
	y: number;
	input: string; // 接続元のID
}

export interface LogicWire {
	from: string;
	to: string;
	points?: { x: number; y: number }[]; // 曲がり角の座標（オプション）
}

// フローチャートの型定義
export type FlowchartNodeType = "start" | "end" | "process" | "decision" | "connector";

export interface FlowchartNode {
	id: string;
	type: FlowchartNodeType;
	label: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
}

export interface FlowchartEdge {
	from: string;
	to: string;
	label?: string; // "y" or "n" for decision branches
	fromSide?: "bottom" | "right" | "left" | "top";
	toSide?: "top" | "right" | "left" | "bottom";
	points?: { x: number; y: number }[]; // 曲がり角の座標
}
