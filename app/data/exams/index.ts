import type { ExamByYear, ExamNumber } from "../../types";
import { loadExams } from "./loader";

let _loadPromise: Promise<ExamByYear[]> | null = null;
let _byNumberPromise: Promise<Map<ExamNumber, ExamByYear>> | null = null;

export function getAllExams(): Promise<ExamByYear[]> {
	if (!_loadPromise) {
		_loadPromise = loadExams();
	}
	return _loadPromise;
}

function getExamsByNumber(): Promise<Map<ExamNumber, ExamByYear>> {
	if (!_byNumberPromise) {
		_byNumberPromise = getAllExams().then((exams) => new Map(exams.map((e) => [e.examNumber, e])));
	}
	return _byNumberPromise;
}

export async function getExamByNumber(examNumber: ExamNumber): Promise<ExamByYear | undefined> {
	const byNumber = await getExamsByNumber();
	return byNumber.get(examNumber);
}
