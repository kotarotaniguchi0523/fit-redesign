import { describe, expect, it } from "vitest";
import type { Exam } from "../../types";
import { safeParseOrThrow } from "../../utils/zod";
import { getAllExams, getExamByNumber } from "./index";
import { ExamJsonSchema } from "./schema";

/**
 * loader の public API（getAllExams / getExamByNumber）の古典派ユニットテスト。
 * astro:content には依存せず、import.meta.glob 経由で実データを読み込む純粋ロジックを
 * 直接呼び出して入出力（AAA）を検証する。
 */
describe("exams loader public API", () => {
	it("getAllExams returns 9 exam groups sorted by examNumber", async () => {
		// Arrange / Act
		const exams = await getAllExams();

		// Assert
		expect(exams).toHaveLength(9);
		expect(exams.map((e) => e.examNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("getAllExams shapes each group with title, availableYears and exams map", async () => {
		// Arrange / Act
		const exams = await getAllExams();
		const examOne = exams.find((e) => e.examNumber === 1);

		// Assert
		expect(examOne).toBeDefined();
		expect(examOne?.title).toBe("基数変換");
		expect(examOne?.availableYears).toEqual(["2013", "2014", "2015", "2016", "2017"]);
		// exams map keyed by year, each value a fully-formed Exam
		expect(Object.keys(examOne?.exams ?? {}).sort()).toEqual([
			"2013",
			"2014",
			"2015",
			"2016",
			"2017",
		]);
		const exam2013 = examOne?.exams["2013"];
		expect(exam2013?.id).toBe("exam1-2013");
		expect(exam2013?.number).toBe(1);
		expect(exam2013?.questions.length).toBeGreaterThan(0);
	});

	it("getAllExams returns the same cached promise across calls", async () => {
		// Arrange / Act
		const first = await getAllExams();
		const second = await getAllExams();

		// Assert — index.ts memoizes the load promise
		expect(first).toBe(second);
	});

	it("getExamByNumber returns the matching group", async () => {
		// Arrange / Act
		const examByYear = await getExamByNumber(9);

		// Assert — exam 9 only has 2013 / 2014 per meta
		expect(examByYear?.examNumber).toBe(9);
		expect(examByYear?.availableYears).toEqual(["2013", "2014"]);
	});

	it("getExamByNumber resolves every meta-declared exam number", async () => {
		// Arrange
		const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

		// Act
		const results = await Promise.all(numbers.map((n) => getExamByNumber(n)));

		// Assert — all 9 numbers present in meta resolve to a group
		expect(results.every((r) => r !== undefined)).toBe(true);
		expect(results.map((r) => r?.examNumber)).toEqual([...numbers]);
	});
});

describe("exams loader schema validation (rejection path)", () => {
	const baseValidExam = {
		id: "exam1-2099",
		number: 1,
		title: "テスト試験",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test.pdf",
		answerPdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test-answer.pdf",
		questions: [
			{
				id: "q1",
				number: 1,
				text: "問題文",
				answer: "ア",
			},
		],
	};

	it("accepts a well-formed exam object", () => {
		// Arrange / Act / Assert
		const parsed = safeParseOrThrow(ExamJsonSchema, baseValidExam, "valid");
		expect(parsed.id).toBe("exam1-2099");
	});

	it("rejects an exam with a malformed id", () => {
		// Arrange
		const bad = { ...baseValidExam, id: "not-an-exam-id" };

		// Act / Assert
		expect(() => safeParseOrThrow(ExamJsonSchema, bad, "bad id")).toThrow(/bad id/);
	});

	it("rejects an exam with examNumber out of range", () => {
		// Arrange
		const bad = { ...baseValidExam, number: 99 };

		// Act / Assert
		expect(() => safeParseOrThrow(ExamJsonSchema, bad, "bad number")).toThrow();
	});

	it("rejects an exam missing required questions field", () => {
		// Arrange
		const { questions: _omitted, ...bad } = baseValidExam;

		// Act / Assert
		expect(() =>
			safeParseOrThrow(ExamJsonSchema, bad as unknown as Exam, "missing questions"),
		).toThrow();
	});

	it("rejects a pdfPath outside the 明治 配信 base", () => {
		// Arrange
		const bad = { ...baseValidExam, pdfPath: "https://evil.example.com/test.pdf" };

		// Act / Assert
		expect(() => safeParseOrThrow(ExamJsonSchema, bad, "bad pdf path")).toThrow();
	});
});
