import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MEIJI_FIT_BASE } from "../../types/index.ts";
import metaJson from "../exams-json/exams-meta.json" with { type: "json" };
import { assembleExamsByYear } from "./assemble.ts";
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

/**
 * modules.generated.ts の索引から全試験を組み立てる。
 * Vite 固有の `import.meta.glob` を使わないため `remix test`（Node）で動く。
 */
function buildAllExams() {
	const meta = ExamsMetaSchema.parse(metaJson);
	const entries = Object.entries(examModules).flatMap(([filePath, module]) => {
		const parsed = ExamJsonSchema.parse(getJsonValue(module));
		const path = ParsedJsonExamFilePathSchema.safeParse(filePath);
		if (!path.success) {
			return [];
		}
		return [{ ...path.data, data: parsed }];
	});
	return assembleExamsByYear(meta.exams, entries);
}

const allExams = buildAllExams();

describe("exam data integrity", () => {
	it("all exam json files conform to schema", () => {
		for (const module of Object.values(examModules)) {
			assert.ok(ExamJsonSchema.safeParse(getJsonValue(module)).success);
		}
	});

	it("all exam json module paths conform to schema", () => {
		for (const filePath of Object.keys(examModules)) {
			assert.ok(ParsedJsonExamFilePathSchema.safeParse(filePath).success, filePath);
		}
	});

	it("meta json conforms to schema", () => {
		assert.ok(ExamsMetaSchema.safeParse(metaJson).success);
	});

	it("question IDs are unique within each exam", () => {
		for (const examByYear of allExams) {
			for (const exam of Object.values(examByYear.exams)) {
				if (!exam) {
					continue;
				}
				const seen = new Set<string>();
				for (const question of exam.questions) {
					assert.ok(!seen.has(question.id), `duplicate question id in ${exam.id}: ${question.id}`);
					seen.add(question.id);
				}
			}
		}
		assert.ok(allExams.length > 0);
	});

	it("all pdf/answer paths are well-formed 明治 配信 URL", () => {
		for (const examByYear of allExams) {
			for (const exam of Object.values(examByYear.exams)) {
				if (!exam) {
					continue;
				}
				assert.ok(exam.pdfPath.startsWith(`${MEIJI_FIT_BASE}/`), `bad pdfPath: ${exam.pdfPath}`);
				assert.ok(
					exam.answerPdfPath.startsWith(`${MEIJI_FIT_BASE}/`),
					`bad answerPdfPath: ${exam.answerPdfPath}`,
				);
				assert.doesNotThrow(() => new URL(exam.pdfPath));
				assert.doesNotThrow(() => new URL(exam.answerPdfPath));
			}
		}
	});
});
