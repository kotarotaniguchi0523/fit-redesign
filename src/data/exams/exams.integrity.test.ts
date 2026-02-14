// @ts-expect-error Node typings are intentionally not included in app tsconfig.
import { existsSync } from "node:fs";
// @ts-expect-error Node typings are intentionally not included in app tsconfig.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { unitBasedTabs } from "../units";
import { allExams, getExamByNumber } from ".";
import { ExamJsonSchema, ExamsMetaSchema, ParsedJsonExamFilePathSchema } from "./schema";

const examModules = import.meta.glob<{ default: unknown }>("../exams-json/exam[0-9]-*.json", {
	eager: true,
});
const metaModule = import.meta.glob<{ default: unknown }>("../exams-json/exams-meta.json", {
	eager: true,
});

function getJsonValue(module: unknown): unknown {
	if (module && typeof module === "object" && "default" in module) {
		return (module as { default: unknown }).default;
	}
	return module;
}

describe("exam data integrity", () => {
	it("all exam json files conform to schema", () => {
		for (const module of Object.values(examModules)) {
			const result = ExamJsonSchema.safeParse(getJsonValue(module));
			expect(result.success).toBe(true);
		}
	});

	it("all exam json module paths conform to schema", () => {
		for (const filePath of Object.keys(examModules)) {
			const result = ParsedJsonExamFilePathSchema.safeParse(filePath);
			expect(result.success).toBe(true);
		}
	});

	it("meta json conforms to schema", () => {
		const meta = getJsonValue(Object.values(metaModule)[0]);
		const result = ExamsMetaSchema.safeParse(meta);
		expect(result.success).toBe(true);
	});

	it("question IDs are unique within each exam", () => {
		for (const examByYear of allExams) {
			for (const exam of Object.values(examByYear.exams)) {
				if (!exam) continue;
				const seen = new Set<string>();
				for (const question of exam.questions) {
					if (seen.has(question.id)) {
						throw new Error(`duplicate question id in ${exam.id}: ${question.id}`);
					}
					seen.add(question.id);
				}
			}
		}
		expect(allExams.length).toBeGreaterThan(0);
	});

	it("all pdf paths exist under public directory", () => {
		for (const examByYear of allExams) {
			for (const exam of Object.values(examByYear.exams)) {
				if (!exam) continue;
				const cwd = (globalThis as { process?: { cwd: () => string } }).process?.cwd() ?? "";
				const pdfPath = path.join(cwd, "public", exam.pdfPath.replace(/^\//, ""));
				const answerPath = path.join(cwd, "public", exam.answerPdfPath.replace(/^\//, ""));
				expect(existsSync(pdfPath), `missing pdfPath: ${exam.pdfPath}`).toBe(true);
				expect(existsSync(answerPath), `missing answerPdfPath: ${exam.answerPdfPath}`).toBe(true);
			}
		}
	});

	it("unit mappings only reference existing exams and years", () => {
		for (const unit of unitBasedTabs) {
			for (const mapping of unit.examMapping) {
				for (const examNumber of mapping.examNumbers) {
					const examByNumber = getExamByNumber(examNumber);
					expect(examByNumber, `missing exam number: ${examNumber}`).toBeDefined();
					expect(
						examByNumber?.availableYears.includes(mapping.year),
						`exam ${examNumber} missing year ${mapping.year}`,
					).toBe(true);
				}
			}
		}
	});
});
