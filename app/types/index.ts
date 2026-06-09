// 図コンポーネントの型をインポート

import type { ExamId, ExamNumber, PdfPath, QuestionId, SlideId, UnitTabId, Year } from "./domain";
import type {
	DataTableColumn,
	DataTableRow,
	FlowchartEdge,
	FlowchartNode,
	GateType,
	HuffmanTableData,
	LinkedListEntry,
	LogicGate,
	LogicInput,
	LogicOutput,
	LogicWire,
	NormalDistributionEntry,
	StateNode,
	Transition,
	TreeNode,
	TruthTableColumn,
	TruthTableRow,
} from "./figures";

export type {
	ExamId,
	ExamNumber,
	PdfPath,
	QuestionId,
	SlideId,
	UnitTabId,
	UserId,
	Year,
} from "./domain";
export {
	EXAM_NUMBERS,
	ExamIdSchema,
	ExamNumberSchema,
	isExamNumber,
	isYear,
	MEIJI_FIT_BASE,
	PdfPathSchema,
	QuestionIdSchema,
	SlideIdSchema,
	UnitTabIdSchema,
	UserIdSchema,
	YEARS,
	YearSchema,
} from "./domain";

// 問題の選択肢
export interface QuestionOption {
	label: string;
	value: string;
	isCorrect?: boolean;
}

// 図コンポーネントの型をre-export
export type {
	DataTableColumn,
	DataTableRow,
	FlowchartEdge,
	FlowchartNode,
	GateType,
	HuffmanTableData,
	LinkedListEntry,
	LogicGate,
	LogicInput,
	LogicOutput,
	LogicWire,
	NormalDistributionEntry,
	StateNode,
	Transition,
	TreeNode,
	TruthTableColumn,
	TruthTableRow,
};

// 図データの型定義
export type FigureData =
	| {
			type: "stateDiagram";
			nodes: StateNode[];
			transitions: Transition[];
	  }
	| { type: "binaryTree"; root: TreeNode; width?: number; height?: number }
	| { type: "truthTable"; columns: TruthTableColumn[]; rows: TruthTableRow[] }
	| { type: "parityCheck"; data: number[][] }
	| { type: "dataTable"; columns: DataTableColumn[]; rows: DataTableRow[] }
	| { type: "huffmanTable"; data: HuffmanTableData }
	| { type: "linkedListTable"; entries: LinkedListEntry[] }
	| { type: "normalDistributionTable"; entries: NormalDistributionEntry[] }
	| {
			type: "logicCircuit";
			inputs: LogicInput[];
			outputs: LogicOutput[];
			gates: LogicGate[];
			wires: LogicWire[];
	  }
	| {
			type: "flowchart";
			nodes: FlowchartNode[];
			edges: FlowchartEdge[];
			width?: number;
			height?: number;
	  };

// 問題
export interface Question {
	id: QuestionId;
	number: number;
	text: string;
	options?: QuestionOption[];
	answer: string;
	explanation?: string;
	figureDescription?: string; // 図の説明（状態遷移図、表、グラフなど）
	figureData?: FigureData; // 図データ
}

// 小テスト
export interface Exam {
	id: ExamId;
	number: ExamNumber;
	title: string;
	pdfPath: PdfPath;
	answerPdfPath: PdfPath;
	questions: Question[];
}

// 小テスト（年度別）
export interface ExamByYear {
	examNumber: ExamNumber;
	title: string;
	availableYears: Year[];
	exams: Partial<Record<Year, Exam>>;
}

// 講義スライド
export interface Slide {
	id: SlideId;
	title: string;
	pdfPath: PdfPath;
}

// 単元
export interface Unit {
	id: string;
	number: number;
	name: string;
	slides: Slide[];
	exams?: ExamByYear;
	is2013Only?: boolean; // 2013年度のみ独立した単元
}

// 単元ベースのタブ（トップレベルが単元、各単元内で年度選択）
export interface UnitBasedTab {
	id: UnitTabId;
	name: string; // 単元名（例: "基数変換"）
	title: string; // タイトル（例: "単元1: 基数変換"）
	icon: string; // 絵文字アイコン（例: "🔢"）
	description: string; // 単元の説明（例: "2進数・8進数・16進数の変換"）
	slides: Slide[]; // 講義スライド
	// 年度別の試験マッピング
	examMapping: {
		year: Year;
		examNumbers: ExamNumber[]; // この年度でこの単元に対応する試験番号
		integratedTitle?: string; // 統合試験の場合のタイトル（例: "オートマトン・符号理論"）
	}[];
}

// Result types
export type { Result } from "./result";
export { err, ok } from "./result";
