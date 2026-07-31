import { describe, expect, it } from "vitest";
import { type ExamByYear, type ExamNumber, MEIJI_FIT_BASE } from "../../types";
import { unitBasedTabs } from "../units";
import { assembleExamsByYear } from "./assemble";
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

/**
 * Build allExams from glob-loaded JSON, using import.meta.glob.
 * Runnable in plain Vitest.
 */
function buildAllExams(): ExamByYear[] {
	const meta = ExamsMetaSchema.parse(getJsonValue(Object.values(metaModule)[0]));

	const entries = Object.entries(examModules).flatMap(([filePath, module]) => {
		const parsed = ExamJsonSchema.parse(getJsonValue(module));
		const match = filePath.match(/exam(\d+)-(\d{4})\.json$/);
		if (!match) {
			return [];
		}
		return [{ examNumber: Number(match[1]), year: match[2], data: parsed }];
	});

	return assembleExamsByYear(meta.exams, entries);
}

const allExams = buildAllExams();

function getExamByNumber(num: ExamNumber): ExamByYear | undefined {
	return allExams.find((e) => e.examNumber === num);
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
				if (!exam) {
					continue;
				}
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

	it("all pdf/answer paths are well-formed 明治 配信 URL", () => {
		for (const examByYear of allExams) {
			for (const exam of Object.values(examByYear.exams)) {
				if (!exam) {
					continue;
				}
				// 配布資料は明治大学の公開ページを直接参照する（ローカル配信しない）
				expect(exam.pdfPath.startsWith(`${MEIJI_FIT_BASE}/`), `bad pdfPath: ${exam.pdfPath}`).toBe(
					true,
				);
				expect(
					exam.answerPdfPath.startsWith(`${MEIJI_FIT_BASE}/`),
					`bad answerPdfPath: ${exam.answerPdfPath}`,
				).toBe(true);
				expect(() => new URL(exam.pdfPath)).not.toThrow();
				expect(() => new URL(exam.answerPdfPath)).not.toThrow();
			}
		}
	});

	it("2015 question 4 matches the source PDF and official answer", () => {
		for (const examNumber of [3, 4] as const) {
			const question = getExamByNumber(examNumber)?.exams["2015"]?.questions.find(
				(item) => item.number === 4,
			);

			expect(question?.text).toContain("¬(¬X ∧ ¬Y)");
			expect(question?.answer).toBe("0,1,1,1");
			expect(question?.explanation).toContain("= X ∨ Y");
			expect(question?.figureData).toEqual({
				type: "truthTable",
				columns: [
					{ key: "x", label: "X" },
					{ key: "y", label: "Y" },
					{ key: "f", label: "F" },
				],
				rows: [
					{ x: 0, y: 0, f: "" },
					{ x: 0, y: 1, f: "" },
					{ x: 1, y: 0, f: "" },
					{ x: 1, y: 1, f: "" },
				],
			});
		}
	});

	it("2014 doubly linked list includes its address and pointer table", () => {
		const question = getExamByNumber(8)?.exams["2014"]?.questions.find(
			(item) => item.id === "exam8-2014-q2",
		);

		expect(question?.figureData).toMatchObject({
			type: "dataTable",
			columns: [
				{ key: "address", label: "アドレス" },
				{ key: "previous", label: "← 前" },
				{ key: "data", label: "データ" },
				{ key: "next", label: "次 →" },
			],
		});
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
