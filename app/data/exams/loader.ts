import { type DeepReadonly, deepFreeze } from "../../lib/immutable";
import { safeParseOrThrow } from "../../lib/zod";
import type { ExamByYear } from "../../types";
import metaJson from "../exams-json/exams-meta.json";
import { assembleExamsByYear, type ParsedExamEntry } from "./assemble";
import {
	ExamJsonSchema,
	ExamsMetaSchema,
	JsonModuleSchema,
	ParsedJsonExamFilePathSchema,
} from "./schema";

const examModules = import.meta.glob<{ default: unknown }>("../exams-json/exam[0-9]-*.json", {
	eager: true,
});

function getJsonValue(module: unknown): unknown {
	const parsed = JsonModuleSchema.safeParse(module);
	return parsed.success ? parsed.data.default : module;
}

function parseExamEntries(): ParsedExamEntry[] {
	return Object.entries(examModules).flatMap(([filePath, module]) => {
		const path = ParsedJsonExamFilePathSchema.safeParse(filePath);
		if (!path.success) {
			return [];
		}
		const data = safeParseOrThrow(
			ExamJsonSchema,
			getJsonValue(module),
			`Invalid exam json: ${filePath}`,
		);
		return [{ ...path.data, data }];
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
export async function loadExams(): Promise<DeepReadonly<ExamByYear[]>> {
	const parsedMeta = safeParseOrThrow(ExamsMetaSchema, metaJson, "Invalid exams meta");
	const entries = parseExamEntries();
	const exams = assembleExamsByYear(parsedMeta.exams, entries);
	deepFreeze(exams);
	return exams;
}
