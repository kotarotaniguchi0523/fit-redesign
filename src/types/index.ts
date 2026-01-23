// 年度の型
export type Year = "2013" | "2014" | "2015" | "2016" | "2017";

// 年度別のサフィックス
export const yearSuffix: Record<Year, string> = {
	"2013": "",
	"2014": "b",
	"2015": "c",
	"2016": "d",
	"2017": "e",
};

// 問題の選択肢
export interface QuestionOption {
	label: string;
	value: string;
	isCorrect?: boolean;
}

// 問題
export interface Question {
	id: string;
	number: number;
	text: string;
	options?: QuestionOption[];
	answer: string;
	explanation?: string;
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
