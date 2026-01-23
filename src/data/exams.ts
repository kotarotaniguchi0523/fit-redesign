import type { ExamByYear } from "../types/index";
import { exam1_2017, exam2_2017 } from "./exams/exam1-base";
import { exam4_2017 } from "./exams/exam4-logic";
import { exam6_2017 } from "./exams/exam6-fsm";
import { exam7_2017 } from "./exams/exam7-ecc";
import { exam8_2017 } from "./exams/exam8-stack";

// 小テスト1: 基数変換
export const exam1: ExamByYear = {
	examNumber: 1,
	title: "基数変換",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {
		"2017": {
			id: "exam1-2017",
			number: 1,
			title: "基数変換 (2017)",
			pdfPath: "/pdf/Exam1e-Base.pdf", // 注: PDFファイルが不足
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam1_2017,
		},
	},
};

// 小テスト2: 負数表現（2013年度のみ）/ 浮動小数点+論理演算（2014年度以降）
export const exam2: ExamByYear = {
	examNumber: 2,
	title: "負数表現 / 浮動小数点・論理演算",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {
		"2017": {
			id: "exam2-2017",
			number: 2,
			title: "負数表現 (2017)",
			pdfPath: "/pdf/Exam2e-Negative.pdf", // 注: PDFファイルが不足
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam2_2017,
		},
	},
};

// 小テスト3: 浮動小数点（2013年度のみ）/ 集合+確率（2014年度以降）
export const exam3: ExamByYear = {
	examNumber: 3,
	title: "浮動小数点 / 集合・確率",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {},
};

// 小テスト4: 論理演算（2013年度のみ）/ オートマトン+符号理論（2014年度以降）
export const exam4: ExamByYear = {
	examNumber: 4,
	title: "論理演算 / オートマトン・符号理論",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {
		"2017": {
			id: "exam4-2017",
			number: 4,
			title: "論理演算 (2017)",
			pdfPath: "/pdf/Exam4e-logic.pdf",
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam4_2017,
		},
	},
};

// 小テスト5: 集合（2013年度のみ）/ データ構造+ソート（2014年度以降）
// 注: 2017年度は問題4（確率）として解答HTMLに記載されているが、PDFが不足
export const exam5: ExamByYear = {
	examNumber: 5,
	title: "集合 / データ構造・ソート",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {},
};

// 小テスト6: 確率（2013年度のみ）/ FSM+確率+データ構造（2017年度）
export const exam6: ExamByYear = {
	examNumber: 6,
	title: "確率 / FSM・確率・データ構造",
	availableYears: ["2013", "2017"],
	exams: {
		"2017": {
			id: "exam6-2017",
			number: 6,
			title: "FSM・確率・データ構造 (2017)",
			pdfPath: "/pdf/Exam6e-FSM.pdf",
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam6_2017,
		},
	},
};

// 小テスト7: オートマトン（2013年度のみ）/ 符号理論（2017年度）
export const exam7: ExamByYear = {
	examNumber: 7,
	title: "オートマトン / 符号理論",
	availableYears: ["2013", "2017"],
	exams: {
		"2017": {
			id: "exam7-2017",
			number: 7,
			title: "符号理論 (2017)",
			pdfPath: "/pdf/Exam7e-ECC.pdf",
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam7_2017,
		},
	},
};

// 小テスト8: 符号理論（2013年度のみ）/ データ構造（2017年度）
export const exam8: ExamByYear = {
	examNumber: 8,
	title: "符号理論 / データ構造",
	availableYears: ["2013", "2017"],
	exams: {
		"2017": {
			id: "exam8-2017",
			number: 8,
			title: "データ構造 (2017)",
			pdfPath: "/pdf/Exam8e-Stack.pdf", // 注: PDFファイルが不足
			answerPdfPath: "/pdf/Exam2017-Ans.html",
			questions: exam8_2017,
		},
	},
};

// 小テスト9: データ構造（2013年度のみ）
export const exam9: ExamByYear = {
	examNumber: 9,
	title: "データ構造",
	availableYears: ["2013"],
	exams: {},
};

export const allExams: ExamByYear[] = [
	exam1,
	exam2,
	exam3,
	exam4,
	exam5,
	exam6,
	exam7,
	exam8,
	exam9,
];
