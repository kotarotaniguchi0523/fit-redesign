import { describe, expect, it } from "vitest";
import { safeParseOrThrow } from "../../lib/zod";
import type { Exam } from "../../types";
import { getAllExams, getExamByNumber, selectVisibleExamNumbers } from "./index";
import { ExamJsonSchema } from "./schema";

/**
 * loader の public API（getAllExams / getExamByNumber）の古典派ユニットテスト。
 * import.meta.glob 経由で実データを読み込む純粋ロジックを
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

describe("selectVisibleExamNumbers", () => {
	it("exam の問題集合が他候補の真部分集合なら除外する（統合 exam⊇原本 exam）", () => {
		// Arrange: exam4 が exam6 と exam7 を内包するケース（unit-automaton/2016 相当）
		const candidates = [
			{
				examNumber: 4,
				questionIds: [
					"exam6-2016-q1",
					"exam6-2016-q2",
					"exam6-2016-q3",
					"exam6-2016-q4",
					"exam6-2016-q5",
					"exam7-2016-q1",
					"exam7-2016-q2",
					"exam7-2016-q3",
					"exam7-2016-q4",
					"exam7-2016-q5",
				],
			},
			{
				examNumber: 6,
				questionIds: [
					"exam6-2016-q1",
					"exam6-2016-q2",
					"exam6-2016-q3",
					"exam6-2016-q4",
					"exam6-2016-q5",
				],
			},
		];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([4]);
	});

	it("exam4⊇exam7 のケースで exam7 を除外する（unit-ecc/2016 相当）", () => {
		// Arrange
		const candidates = [
			{
				examNumber: 4,
				questionIds: [
					"exam6-2016-q1",
					"exam6-2016-q2",
					"exam6-2016-q3",
					"exam6-2016-q4",
					"exam6-2016-q5",
					"exam7-2016-q1",
					"exam7-2016-q2",
					"exam7-2016-q3",
					"exam7-2016-q4",
					"exam7-2016-q5",
				],
			},
			{
				examNumber: 7,
				questionIds: [
					"exam7-2016-q1",
					"exam7-2016-q2",
					"exam7-2016-q3",
					"exam7-2016-q4",
					"exam7-2016-q5",
				],
			},
		];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([4]);
	});

	it("問題集合が完全一致の場合は番号が小さい方を残す（unit-data-structure/2016 相当: exam5==exam8 → [5]）", () => {
		// Arrange
		const candidates = [
			{
				examNumber: 5,
				questionIds: [
					"exam8-2016-q1",
					"exam8-2016-q2",
					"exam8-2016-q3",
					"exam8-2016-q4",
					"exam8-2016-q5",
				],
			},
			{
				examNumber: 8,
				questionIds: [
					"exam8-2016-q1",
					"exam8-2016-q2",
					"exam8-2016-q3",
					"exam8-2016-q4",
					"exam8-2016-q5",
				],
			},
		];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([5]);
	});

	it("exam8 が除外されるが exam6 は別内容なので残す（unit-data-structure/2017 相当: [5,6,8] → [5,6]）", () => {
		// Arrange
		const candidates = [
			{
				examNumber: 5,
				questionIds: [
					"exam8-2017-q1",
					"exam8-2017-q2",
					"exam8-2017-q3",
					"exam8-2017-q4",
					"exam8-2017-q5",
				],
			},
			{
				examNumber: 6,
				questionIds: [
					"exam6-2017-q1",
					"exam6-2017-q2",
					"exam6-2017-q3",
					"exam6-2017-q4",
					"exam6-2017-q5",
				],
			},
			{
				examNumber: 8,
				questionIds: [
					"exam8-2017-q1",
					"exam8-2017-q2",
					"exam8-2017-q3",
					"exam8-2017-q4",
					"exam8-2017-q5",
				],
			},
		];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([5, 6]);
	});

	it("問題集合が互いに素の場合は全候補を残す（unit-set-prob/2013 相当: [5,6]→[5,6]）", () => {
		// Arrange
		const candidates = [
			{ examNumber: 5, questionIds: ["exam5-q1", "exam5-q2"] },
			{ examNumber: 6, questionIds: ["exam6-q1", "exam6-q2"] },
		];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([5, 6]);
	});

	it("候補が単一の場合はそのまま返す", () => {
		// Arrange
		const candidates = [{ examNumber: 1, questionIds: ["exam1-q1", "exam1-q2"] }];

		// Act / Assert
		expect(selectVisibleExamNumbers(candidates)).toEqual([1]);
	});

	it("空配列の questionIds を持つ候補は他を除外しない", () => {
		// Arrange: questionIds が空なら部分集合判定が空集合として扱われ、他に含まれることはない
		const candidates = [
			{ examNumber: 4, questionIds: [] },
			{ examNumber: 6, questionIds: ["exam6-q1", "exam6-q2"] },
		];

		// Act: 空配列はどの集合の部分集合にもなる（every がゼロ要素で true）ため exam4 は除外される
		// 一方 exam6 は exam4 に含まれないので残る
		const result = selectVisibleExamNumbers(candidates);
		expect(result).toContain(6);
	});
});

describe("exams loader schema validation (rejection path)", () => {
	const baseValidExam = {
		id: "exam1-2013",
		number: 1,
		title: "テスト試験",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test.pdf",
		answerPdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test-answer.pdf",
		questions: [
			{
				id: "exam1-2013-q1",
				number: 1,
				text: "問題文",
				answer: "ア",
			},
		],
	};

	it("accepts a well-formed exam object", () => {
		// Arrange / Act / Assert
		const parsed = safeParseOrThrow(ExamJsonSchema, baseValidExam, "valid");
		expect(parsed.id).toBe("exam1-2013");
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
