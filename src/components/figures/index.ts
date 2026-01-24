// 図の型定義は src/types/figures から re-export
export type {
	StateNode,
	Transition,
	TreeNode,
	TruthTableColumn,
	TruthTableRow,
} from "../../types/figures";
export type { BinaryTreeProps } from "./BinaryTree";
export { BinaryTree } from "./BinaryTree";
export type { ParityCheckProps } from "./ParityCheck";
export { ParityCheck } from "./ParityCheck";
export type { StateDiagramProps } from "./StateDiagram";
export { StateDiagram } from "./StateDiagram";
export type { TruthTableProps } from "./TruthTable";
export { TruthTable } from "./TruthTable";
