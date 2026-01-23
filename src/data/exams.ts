import type { ExamByYear } from "../types/index";

const createExamPaths = (examNumber: number, suffix: string) => ({
	pdfPath: `/pdf/Exam${examNumber}${suffix}.pdf`,
	answerPdfPath: `/pdf/Exam${examNumber}${suffix}A.pdf`,
});

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
			...createExamPaths(1, "e"),
			questions: [
				{
					id: "q1-1",
					number: 1,
					text: "10進数 22 を2進数で表せ",
					answer: "10110",
				},
				{
					id: "q1-2",
					number: 2,
					text: "114.132 を8進数で表せ",
					answer: "162.105...",
					explanation: "整数部: 114 ÷ 8 = 14 余り 2, 14 ÷ 8 = 1 余り 6, 1 ÷ 8 = 0 余り 1 → 162",
				},
				{
					id: "q1-3",
					number: 3,
					text: "2進数 110101 を10進数で表せ",
					answer: "53",
				},
			],
		},
	},
};

// 小テスト2: 負数表現（2013年度のみ）/ 浮動小数点+論理演算（2014年度以降）
export const exam2: ExamByYear = {
	examNumber: 2,
	title: "負数表現 / 浮動小数点・論理演算",
	availableYears: ["2013", "2014", "2015", "2016"],
	exams: {},
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
	exams: {},
};

// 小テスト5: 集合（2013年度のみ）/ データ構造+ソート（2014年度以降）
export const exam5: ExamByYear = {
	examNumber: 5,
	title: "集合 / データ構造・ソート",
	availableYears: ["2013", "2014", "2015", "2016", "2017"],
	exams: {},
};

// 小テスト6: 確率（2013年度のみ）
export const exam6: ExamByYear = {
	examNumber: 6,
	title: "確率",
	availableYears: ["2013"],
	exams: {},
};

// 小テスト7: オートマトン（2013年度のみ）
export const exam7: ExamByYear = {
	examNumber: 7,
	title: "オートマトン",
	availableYears: ["2013"],
	exams: {},
};

// 小テスト8: 符号理論（2013年度のみ）
export const exam8: ExamByYear = {
	examNumber: 8,
	title: "符号理論",
	availableYears: ["2013"],
	exams: {},
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
