import type { FigureData } from "../data/exams/schema";

type FigureOf<Type extends FigureData["type"]> = Extract<FigureData, { type: Type }>;

export type StateNode = FigureOf<"stateDiagram">["nodes"][number];
export type Transition = FigureOf<"stateDiagram">["transitions"][number];
export type TreeNode = FigureOf<"binaryTree">["root"];
export type TruthTableColumn = FigureOf<"truthTable">["columns"][number];
export type TruthTableRow = FigureOf<"truthTable">["rows"][number];
export type LinkedListEntry = FigureOf<"linkedListTable">["entries"][number];
export type NormalDistributionEntry = FigureOf<"normalDistributionTable">["entries"][number];
export type LogicInput = FigureOf<"logicCircuit">["inputs"][number];
export type LogicOutput = FigureOf<"logicCircuit">["outputs"][number];
export type LogicGate = FigureOf<"logicCircuit">["gates"][number];
export type LogicWire = FigureOf<"logicCircuit">["wires"][number];
export type FlowchartNode = FigureOf<"flowchart">["nodes"][number];
export type FlowchartEdge = FigureOf<"flowchart">["edges"][number];
