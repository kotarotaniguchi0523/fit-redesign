import type { ExamByYear, ExamNumber } from "../../types";
import { loadExams } from "./loader";

let _loadPromise: Promise<ExamByYear[]> | null = null;

export function getAllExams(): Promise<ExamByYear[]> {
	if (!_loadPromise) {
		_loadPromise = loadExams();
	}
	return _loadPromise;
}

export async function getExamByNumber(examNumber: ExamNumber): Promise<ExamByYear | undefined> {
	const exams = await getAllExams();
	return exams.find((e) => e.examNumber === examNumber);
}
