// 図コンポーネントの型をインポート
import type { StateNode, Transition, TreeNode, TruthTableColumn, TruthTableRow } from "./figures";

// 年度一覧
export const YEARS = ["2013", "2014", "2015", "2016", "2017"] as const;

// 年度の型
export type Year = (typeof YEARS)[number];

// 問題の選択肢
export interface QuestionOption {
	label: string;
	value: string;
	isCorrect?: boolean;
}

// 図コンポーネントの型をre-export
export type { StateNode, Transition, TreeNode, TruthTableColumn, TruthTableRow };

// 図データの型定義
export type FigureData =
	| {
			type: "stateDiagram";
			nodes: StateNode[];
			transitions: Transition[];
	  }
	| { type: "binaryTree"; root: TreeNode }
	| { type: "truthTable"; columns: TruthTableColumn[]; rows: TruthTableRow[] }
	| { type: "parityCheck"; data: number[][] };

// 問題
export interface Question {
	id: string;
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
	id: string;
	number: number;
	title: string;
	pdfPath: string;
	answerPdfPath: string;
	questions: Question[];
}

// 小テスト（年度別）
export interface ExamByYear {
	examNumber: number;
	title: string;
	availableYears: Year[];
	exams: Partial<Record<Year, Exam>>;
}

// 講義スライド
export interface Slide {
	id: string;
	title: string;
	pdfPath: string;
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

// タブグループ（2014年以降の統合版）
export interface TabGroup {
	id: string;
	name: string;
	units: Unit[];
	examNumber: number;
	title: string;
}

// 統一されたタブアイテム（Unit と TabGroup の統合型）
export interface TabItem {
	id: string;
	name: string;
	title: string; // 小テストのタイトル
	slides: Slide[]; // スライド一覧
	examNumber?: number; // 試験番号（存在する場合）
}
