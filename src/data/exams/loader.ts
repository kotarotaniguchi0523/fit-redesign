import { type Exam, type ExamByYear, type ExamNumber, isExamNumber, type Year } from "../../types";
import { safeParseOrThrow } from "../../utils/zod";
import metaJson from "../exams-json/exams-meta.json";
import { ExamJsonSchema, ExamsMetaSchema, ParsedJsonExamFilePathSchema } from "./schema";

const examModules = import.meta.glob<{ default: unknown }>("../exams-json/exam[0-9]-*.json", {
	eager: true,
});

function getJsonModuleValue(module: unknown): unknown {
	if (module && typeof module === "object" && "default" in module) {
		return (module as { default: unknown }).default;
	}
	return module;
}

function parseExamFilename(filePath: string): { examNumber: ExamNumber; year: Year } | undefined {
	const parsedPath = ParsedJsonExamFilePathSchema.safeParse(filePath);
	if (!parsedPath.success) return undefined;

	const { examNumber, year } = parsedPath.data;
	if (!isExamNumber(examNumber)) return undefined;
	return { examNumber, year };
}

export function loadExams(): ExamByYear[] {
	const parsedMeta = safeParseOrThrow(ExamsMetaSchema, metaJson, "Invalid exams meta");
	const byNumber = new Map<ExamNumber, ExamByYear>();

	for (const entry of parsedMeta.exams) {
		if (!isExamNumber(entry.examNumber)) {
			throw new Error(`Invalid exam number in meta: ${entry.examNumber}`);
		}
		byNumber.set(entry.examNumber, {
			examNumber: entry.examNumber,
			title: entry.title,
			availableYears: [...entry.availableYears],
			exams: {},
		});
	}

	for (const [filePath, module] of Object.entries(examModules)) {
		const fileInfo = parseExamFilename(filePath);
		if (!fileInfo) {
			continue;
		}

		const parsedExamData = safeParseOrThrow(
			ExamJsonSchema,
			getJsonModuleValue(module),
			`Invalid exam data in ${filePath}`,
		);
		const bucket = byNumber.get(fileInfo.examNumber);
		if (!bucket) {
			throw new Error(`Exam meta missing for examNumber ${fileInfo.examNumber}`);
		}

		bucket.exams[fileInfo.year] = parsedExamData as Exam;
	}

	return [...byNumber.values()].sort((a, b) => a.examNumber - b.examNumber);
}
