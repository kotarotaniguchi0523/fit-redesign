import { type DeepReadonly, deepFreezeInPlace } from "../../lib/immutable.ts";
import { safeParseOrThrow } from "../../lib/zod.ts";
import type { ExamByYear } from "../../types/index.ts";
import metaJson from "../exams-json/exams-meta.json" with { type: "json" };
import { assembleExamsByYear, type ParsedExamEntry } from "./assemble.ts";
import { examModules } from "./modules.generated.ts";
import {
	ExamJsonSchema,
	ExamsMetaSchema,
	JsonModuleSchema,
	ParsedJsonExamFilePathSchema,
} from "./schema.ts";

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
 * `modules.generated.ts` が `app/data/exams-json/*.json` を明示的に import し
 * （Vite 固有の `import.meta.glob` を置き換え）、既存 Zod スキーマで検証してから
 * `assembleExamsByYear` で組み立てる。
 *
 * シグネチャは consumer（index.ts の `await getAllExams()`）が壊れないよう
 * Promise を返す async のまま維持する。
 */
export async function loadExams(): Promise<DeepReadonly<ExamByYear[]>> {
	const parsedMeta = safeParseOrThrow(ExamsMetaSchema, metaJson, "Invalid exams meta");
	const entries = parseExamEntries();
	const exams = assembleExamsByYear(parsedMeta.exams, entries);
	deepFreezeInPlace(exams);
	return exams;
}
