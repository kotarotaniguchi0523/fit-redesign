import { safeParseOrThrow } from "../../lib/zod";
import type { ExamByYear } from "../../types";
import metaJson from "../exams-json/exams-meta.json";
import { assembleExamsByYear, type ParsedExamEntry } from "./assemble";
import { ExamJsonSchema, ExamsMetaSchema } from "./schema";

const examModules = import.meta.glob<{ default: unknown }>("../exams-json/exam[0-9]-*.json", {
	eager: true,
});

const EXAM_FILE_RE = /exam(\d+)-(\d{4})\.json$/;

function getJsonValue(module: unknown): unknown {
	if (module && typeof module === "object" && "default" in module) {
		return (module as { default: unknown }).default;
	}
	return module;
}

function parseExamEntries(): ParsedExamEntry[] {
	return Object.entries(examModules).flatMap(([filePath, module]) => {
		const match = filePath.match(EXAM_FILE_RE);
		if (!match) {
			return [];
		}
		const data = safeParseOrThrow(
			ExamJsonSchema,
			getJsonValue(module),
			`Invalid exam json: ${filePath}`,
		);
		return [{ examNumber: Number(match[1]), year: match[2], data }];
	});
}

/**
 * 試験データを framework 非依存に読み込む。
 * `import.meta.glob` で `src/data/exams-json/*.json` を eager import し、
 * 既存 Zod スキーマで検証してから `assembleExamsByYear` で組み立てる。
 *
 * シグネチャは consumer（index.ts の `await getAllExams()`）が壊れないよう
 * Promise を返す async のまま維持する。
 */
// biome-ignore lint/suspicious/useAwait: consumer の Promise シグネチャ安定のため async を維持（中身は同期）
export async function loadExams(): Promise<ExamByYear[]> {
	const parsedMeta = safeParseOrThrow(ExamsMetaSchema, metaJson, "Invalid exams meta");
	const entries = parseExamEntries();
	return assembleExamsByYear(parsedMeta.exams, entries);
}
