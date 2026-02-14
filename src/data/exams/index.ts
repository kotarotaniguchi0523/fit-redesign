import type { ExamByYear, ExamNumber } from "../../types";
import { loadExams } from "./loader";

export const allExams: ExamByYear[] = loadExams();

const examByNumber = new Map<ExamNumber, ExamByYear>(
	allExams.map((exam) => [exam.examNumber, exam] as const),
);

/**
 * examNumberから対応するExamByYearを取得
 * @param examNumber 小テスト番号（1-9）
 * @returns 対応するExamByYear、見つからない場合はundefined
 */
export function getExamByNumber(examNumber: ExamNumber): ExamByYear | undefined {
	return examByNumber.get(examNumber);
}
