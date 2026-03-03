import { getCollection } from "astro:content";
import { safeParseOrThrow } from "../../utils/zod";
import metaJson from "../exams-json/exams-meta.json";
import { assembleExamsByYear } from "./assemble";
import { ExamsMetaSchema } from "./schema";

export async function loadExams() {
	const parsedMeta = safeParseOrThrow(ExamsMetaSchema, metaJson, "Invalid exams meta");
	const examEntries = await getCollection("exams");

	const entries = examEntries.flatMap((entry: { id: string; data: unknown }) => {
		const match = entry.id.match(/^exam(\d+)-(\d{4})$/);
		if (!match) return [];
		return [{ examNumber: Number(match[1]), year: match[2], data: entry.data }];
	});

	return assembleExamsByYear(parsedMeta.exams, entries);
}
