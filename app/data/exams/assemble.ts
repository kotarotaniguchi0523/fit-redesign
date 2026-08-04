import type { Exam, ExamByYear, ExamMeta, ExamNumber, Year } from "../../types";

export type ExamMetaEntry = ExamMeta["exams"][number];

export interface ParsedExamEntry {
	examNumber: ExamNumber;
	year: Year;
	data: Exam;
}

function indexExamsByYear(entries: readonly ParsedExamEntry[]): Partial<Record<Year, Exam>> {
	const byYear: Partial<Record<Year, Exam>> = {};
	for (const entry of entries) {
		byYear[entry.year] = entry.data;
	}
	return byYear;
}

/**
 * メタ情報とパース済み試験エントリから ExamByYear[] を組み立てる。
 * loader.ts と integrity test の両方（どちらも import.meta.glob 経由）から
 * 利用される共通ロジック。
 */
export function assembleExamsByYear(
	metaExams: ExamMetaEntry[],
	entries: ParsedExamEntry[],
): ExamByYear[] {
	const examsByNumber = Map.groupBy(entries, (entry) => entry.examNumber);

	return metaExams
		.map((meta) => ({
			examNumber: meta.examNumber,
			title: meta.title,
			availableYears: meta.availableYears,
			exams: indexExamsByYear(examsByNumber.get(meta.examNumber) ?? []),
		}))
		.sort((a, b) => a.examNumber - b.examNumber);
}
