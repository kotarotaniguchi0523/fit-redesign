import {
	type Exam,
	type ExamByYear,
	type ExamNumber,
	isExamNumber,
	isYear,
	type Year,
} from "../../types";

export interface ExamMetaEntry {
	examNumber: number;
	title: string;
	availableYears: string[];
}

export interface ParsedExamEntry {
	examNumber: number;
	year: string;
	data: unknown;
}

/**
 * メタ情報とパース済み試験エントリから ExamByYear[] を組み立てる。
 * loader.ts (astro:content 経由) と integrity test (import.meta.glob 経由) の
 * 両方から利用される共通ロジック。
 */
export function assembleExamsByYear(
	metaExams: ExamMetaEntry[],
	entries: ParsedExamEntry[],
): ExamByYear[] {
	const validEntries = entries.filter(
		(e): e is ParsedExamEntry & { examNumber: ExamNumber; year: Year } =>
			isExamNumber(e.examNumber) && isYear(e.year),
	);
	const examsByNumber = Map.groupBy(validEntries, (e) => e.examNumber);

	return metaExams
		.filter((e): e is ExamMetaEntry & { examNumber: ExamNumber } => isExamNumber(e.examNumber))
		.map((meta) => ({
			examNumber: meta.examNumber,
			title: meta.title,
			availableYears: meta.availableYears.filter((y): y is Year => isYear(y)),
			// SAFETY: data は Zod スキーマでバリデーション済み（Content Collections またはテスト側で検証）。
			// TypeScript のブランド型 (ExamId, PdfPath 等) とZod推論型の差異を橋渡しするキャスト。
			exams: Object.fromEntries(
				(examsByNumber.get(meta.examNumber) ?? []).map((e) => [e.year, e.data as Exam]),
			) as Partial<Record<Year, Exam>>,
		}))
		.sort((a, b) => a.examNumber - b.examNumber);
}
