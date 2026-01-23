import { type ExamByYear, YEARS } from "../types/index";
// 2013年度
import { exam1_2013 } from "./exams/exam1-base-2013";
// // 2014年度
import { exam1_2014 } from "./exams/exam1-base-2014";
// 2015年度
import { exam1_2015 } from "./exams/exam1-base-2015";
// 2016年度
import { exam1_2016 } from "./exams/exam1-base-2016";
// 2017年度
import { exam1_2017 } from "./exams/exam1-base-2017";
import { exam2_2013 } from "./exams/exam2-negative-2013";
import { exam2_2015 } from "./exams/exam2-negative-2015";
import { exam2_2016 } from "./exams/exam2-negative-2016";
import { exam2_2017 } from "./exams/exam2-negative-2017";
import { exam3_2013 } from "./exams/exam3-float-2013";
import { exam3_2015 } from "./exams/exam3-logic-2015";
import { exam4_2015 } from "./exams/exam4-fsm-2015";
import { exam4_2013 } from "./exams/exam4-logic-2013";
import { exam4_2014 } from "./exams/exam4-logic-2014";
import { exam5_2015 } from "./exams/exam5-ecc-2015";
import { exam5_2013 } from "./exams/exam5-prob-2013";
import { exam6_2013 } from "./exams/exam6-fsm-2013";
import { exam6_2014 } from "./exams/exam6-fsm-2014";
import { exam6_2016 } from "./exams/exam6-fsm-2016";
import { exam6_2017 } from "./exams/exam6-fsm-2017";
import { exam7_2013 } from "./exams/exam7-ecc-2013";
import { exam7_2014 } from "./exams/exam7-ecc-2014";
import { exam7_2016 } from "./exams/exam7-ecc-2016";
import { exam7_2017 } from "./exams/exam7-ecc-2017";
import { exam8_2013 } from "./exams/exam8-stack-2013";
import { exam8_2016 } from "./exams/exam8-stack-2016";
import { exam8_2017 } from "./exams/exam8-stack-2017";
import { exam9_2013 } from "./exams/exam9-sort-2013";
import { exam9_2014 } from "./exams/exam9-sort-2014";

const getAvailableYears = (exams: ExamByYear["exams"]) =>
	YEARS.filter((year) => Boolean(exams[year]));

// 小テスト1: 基数変換
const exam1Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam1-2013",
		number: 1,
		title: "基数変換 (2013)",
		pdfPath: "/pdf/Exam1-Base.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam1_2013,
	},
	"2014": {
		id: "exam1-2014",
		number: 1,
		title: "基数変換 (2014)",
		pdfPath: "/pdf/Exam1b-Base.pdf",
		answerPdfPath: "/pdf/Exam2014-Ans.html",
		questions: exam1_2014,
	},
	"2015": {
		id: "exam1-2015",
		number: 1,
		title: "基数変換 (2015)",
		pdfPath: "/pdf/Exam1c-Base.pdf",
		answerPdfPath: "/pdf/Exam2015-Ans.html",
		questions: exam1_2015,
	},
	"2016": {
		id: "exam1-2016",
		number: 1,
		title: "基数変換 (2016)",
		pdfPath: "/pdf/Exam1d-Base.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam1_2016,
	},
	"2017": {
		id: "exam1-2017",
		number: 1,
		title: "基数変換 (2017)",
		pdfPath: "/pdf/Exam1e-Base.pdf", // 注: PDFファイルが不足
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam1_2017,
	},
};

export const exam1: ExamByYear = {
	examNumber: 1,
	title: "基数変換",
	availableYears: getAvailableYears(exam1Exams),
	exams: exam1Exams,
};

// 小テスト2: 負数表現（2013年度のみ）/ 浮動小数点+論理演算（2014年度以降）
const exam2Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam2-2013",
		number: 2,
		title: "負数表現 (2013)",
		pdfPath: "/pdf/Exam2-Negative.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam2_2013,
	},
	"2015": {
		id: "exam2-2015",
		number: 2,
		title: "負数表現・浮動小数点 (2015)",
		pdfPath: "/pdf/Exam2c-Negative.pdf",
		answerPdfPath: "/pdf/Exam2015-Ans.html",
		questions: exam2_2015,
	},
	"2016": {
		id: "exam2-2016",
		number: 2,
		title: "負数表現 (2016)",
		pdfPath: "/pdf/Exam2d-Negative.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam2_2016,
	},
	"2017": {
		id: "exam2-2017",
		number: 2,
		title: "負数表現 (2017)",
		pdfPath: "/pdf/Exam2e-Negative.pdf", // 注: PDFファイルが不足
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam2_2017,
	},
};

export const exam2: ExamByYear = {
	examNumber: 2,
	title: "負数表現 / 浮動小数点・論理演算",
	availableYears: getAvailableYears(exam2Exams),
	exams: exam2Exams,
};

// 小テスト3: 浮動小数点（2013年度のみ）/ 集合+確率（2014年度以降）
const exam3Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam3-2013",
		number: 3,
		title: "浮動小数点 (2013)",
		pdfPath: "/pdf/Exam3-Float.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam3_2013,
	},
	"2015": {
		id: "exam3-2015",
		number: 3,
		title: "集合・論理演算 (2015)",
		pdfPath: "/pdf/Exam3c-logic.pdf",
		answerPdfPath: "/pdf/Exam2015-Ans.html",
		questions: exam3_2015,
	},
};

export const exam3: ExamByYear = {
	examNumber: 3,
	title: "浮動小数点 / 集合・確率",
	availableYears: getAvailableYears(exam3Exams),
	exams: exam3Exams,
};

// 小テスト4: 論理演算（2013年度のみ）/ オートマトン+符号理論（2014年度以降）
const exam4Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam4-2013",
		number: 4,
		title: "集合と論理 (2013)",
		pdfPath: "/pdf/Exam4-Logic.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam4_2013,
	},
	"2014": {
		id: "exam4-2014",
		number: 4,
		title: "負数表現・論理演算 (2014)",
		pdfPath: "/pdf/Exam2b-Negative.pdf",
		answerPdfPath: "/pdf/Exam2014-Ans.html",
		questions: exam4_2014,
	},
	"2015": {
		id: "exam4-2015",
		number: 4,
		title: "オートマトン・確率・データ構造 (2015)",
		pdfPath: "/pdf/Exam4c-FSM.pdf",
		answerPdfPath: "/pdf/Exam2015-Ans.html",
		questions: exam4_2015,
	},
	"2016": {
		id: "exam4-2016",
		number: 4,
		title: "オートマトン・符号理論 (2016)",
		pdfPath: "/pdf/Exam6d-FSM.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: [...exam6_2016, ...exam7_2016],
	},
	"2017": {
		id: "exam4-2017",
		number: 4,
		title: "オートマトン・符号理論 (2017)",
		pdfPath: "/pdf/Exam6e-FSM.pdf",
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: [...exam6_2017, ...exam7_2017],
	},
};

export const exam4: ExamByYear = {
	examNumber: 4,
	title: "論理演算 / オートマトン・符号理論",
	availableYears: getAvailableYears(exam4Exams),
	exams: exam4Exams,
};

// 小テスト5: 集合（2013年度のみ）/ データ構造+ソート（2014年度以降）
// 注: 2017年度は問題4（確率）として解答HTMLに記載されているが、PDFが不足
const exam5Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam5-2013",
		number: 5,
		title: "確率と統計 (2013)",
		pdfPath: "/pdf/Exam5-Prob.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam5_2013,
	},
	"2015": {
		id: "exam5-2015",
		number: 5,
		title: "符号理論 (2015)",
		pdfPath: "/pdf/Exam5c-ECC.pdf",
		answerPdfPath: "/pdf/Exam2015-Ans.html",
		questions: exam5_2015,
	},
	"2016": {
		id: "exam5-2016",
		number: 5,
		title: "データ構造・符号理論 (2016)",
		pdfPath: "/pdf/Exam8d-Stack.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam8_2016,
	},
	"2017": {
		id: "exam5-2017",
		number: 5,
		title: "データ構造・符号理論 (2017)",
		pdfPath: "/pdf/Exam8e-Stack.pdf",
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam8_2017,
	},
};

export const exam5: ExamByYear = {
	examNumber: 5,
	title: "集合 / データ構造・ソート",
	availableYears: getAvailableYears(exam5Exams),
	exams: exam5Exams,
};

// 小テスト6: 確率（2013年度のみ）/ FSM+確率+データ構造（2017年度）
const exam6Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam6-2013",
		number: 6,
		title: "オートマトン (2013)",
		pdfPath: "/pdf/Exam6-FSM.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam6_2013,
	},
	"2014": {
		id: "exam6-2014",
		number: 6,
		title: "集合・確率・データ構造 (2014)",
		pdfPath: "/pdf/Exam6b-FSM.pdf",
		answerPdfPath: "/pdf/Exam2014-Ans.html",
		questions: exam6_2014,
	},
	"2016": {
		id: "exam6-2016",
		number: 6,
		title: "FSM (2016)",
		pdfPath: "/pdf/Exam6d-FSM.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam6_2016,
	},
	"2017": {
		id: "exam6-2017",
		number: 6,
		title: "FSM・確率・データ構造 (2017)",
		pdfPath: "/pdf/Exam6e-FSM.pdf",
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam6_2017,
	},
};

export const exam6: ExamByYear = {
	examNumber: 6,
	title: "確率 / FSM・確率・データ構造",
	availableYears: getAvailableYears(exam6Exams),
	exams: exam6Exams,
};

// 小テスト7: オートマトン（2013年度のみ）/ 符号理論（2014年度以降）
const exam7Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam7-2013",
		number: 7,
		title: "符号理論 (2013)",
		pdfPath: "/pdf/Exam7-ECC.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam7_2013,
	},
	"2014": {
		id: "exam7-2014",
		number: 7,
		title: "符号理論 (2014)",
		pdfPath: "/pdf/Exam7b-ECC.pdf",
		answerPdfPath: "/pdf/Exam2014-Ans.html",
		questions: exam7_2014,
	},
	"2016": {
		id: "exam7-2016",
		number: 7,
		title: "符号理論 (2016)",
		pdfPath: "/pdf/Exam7d-ECC.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam7_2016,
	},
	"2017": {
		id: "exam7-2017",
		number: 7,
		title: "符号理論 (2017)",
		pdfPath: "/pdf/Exam7e-ECC.pdf",
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam7_2017,
	},
};

export const exam7: ExamByYear = {
	examNumber: 7,
	title: "オートマトン / 符号理論",
	availableYears: getAvailableYears(exam7Exams),
	exams: exam7Exams,
};

// 小テスト8: 符号理論（2013年度のみ）/ データ構造（2017年度）
const exam8Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam8-2013",
		number: 8,
		title: "データ構造 (2013)",
		pdfPath: "/pdf/Exam8-Stack.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam8_2013,
	},
	"2016": {
		id: "exam8-2016",
		number: 8,
		title: "データ構造 (2016)",
		pdfPath: "/pdf/Exam8d-Stack.pdf",
		answerPdfPath: "/pdf/Exam2016-Ans.html",
		questions: exam8_2016,
	},
	"2017": {
		id: "exam8-2017",
		number: 8,
		title: "データ構造 (2017)",
		pdfPath: "/pdf/Exam8e-Stack.pdf", // 注: PDFファイルが不足
		answerPdfPath: "/pdf/Exam2017-Ans.html",
		questions: exam8_2017,
	},
};

export const exam8: ExamByYear = {
	examNumber: 8,
	title: "符号理論 / データ構造",
	availableYears: getAvailableYears(exam8Exams),
	exams: exam8Exams,
};

// 小テスト9: データ構造
const exam9Exams: ExamByYear["exams"] = {
	"2013": {
		id: "exam9-2013",
		number: 9,
		title: "データ構造 (2013)",
		pdfPath: "/pdf/Exam9-Sort.pdf",
		answerPdfPath: "/pdf/Exam2013-Ans.html",
		questions: exam9_2013,
	},
	"2014": {
		id: "exam9-2014",
		number: 9,
		title: "ソート・探索 (2014)",
		pdfPath: "/pdf/Exam9b-Sort.pdf",
		answerPdfPath: "/pdf/Exam2014-Ans.html",
		questions: exam9_2014,
	},
};

export const exam9: ExamByYear = {
	examNumber: 9,
	title: "データ構造 / ソート・探索",
	availableYears: getAvailableYears(exam9Exams),
	exams: exam9Exams,
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

/**
 * examNumberから対応するExamByYearを取得
 * @param examNumber 小テスト番号（1-9）
 * @returns 対応するExamByYear、見つからない場合はundefined
 */
export function getExamByNumber(examNumber: number): ExamByYear | undefined {
	return allExams.find((exam) => exam.examNumber === examNumber);
}
