import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { safeParseOrThrow } from "../../lib/zod.ts";
import { slides } from "../slides.ts";
import { slideOnlyUnits, unitBasedTabs } from "../units.ts";
import { getAllExams, getExamByNumber, selectVisibleExamNumbers } from "./index.ts";
import { ExamJsonSchema } from "./schema.ts";

/**
 * loader の public API（getAllExams / getExamByNumber）の古典派ユニットテスト。
 * modules.generated.ts 経由で実データを読み込む純粋ロジックを直接呼び出し、
 * 入出力（AAA）を検証する。
 */
describe("exams loader public API", () => {
	it("getAllExams returns 9 exam groups sorted by examNumber", async () => {
		const exams = await getAllExams();

		assert.equal(exams.length, 9);
		assert.deepEqual(
			exams.map((exam) => exam.examNumber),
			[1, 2, 3, 4, 5, 6, 7, 8, 9],
		);
	});

	it("getAllExams shapes each group with title, availableYears and exams map", async () => {
		const exams = await getAllExams();
		const examOne = exams.find((exam) => exam.examNumber === 1);

		assert.ok(examOne, "exam 1 exists");
		assert.equal(examOne.title, "基数変換");
		assert.deepEqual(examOne.availableYears, ["2013", "2014", "2015", "2016", "2017"]);
		assert.deepEqual(Object.keys(examOne.exams).sort(), ["2013", "2014", "2015", "2016", "2017"]);

		const exam2013 = examOne.exams["2013"];
		assert.equal(exam2013?.id, "exam1-2013");
		assert.equal(exam2013?.number, 1);
		assert.ok((exam2013?.questions.length ?? 0) > 0, "questions exist");
	});

	it("getAllExams returns the same cached promise across calls", async () => {
		const first = await getAllExams();
		const second = await getAllExams();

		assert.ok(Object.is(first, second), "memoized instance");
	});

	it("共有する静的カタログを再帰的に凍結する", async () => {
		const exams = await getAllExams();
		const firstExam = exams[0]?.exams["2013"];

		assert.ok(Object.isFrozen(exams));
		assert.ok(Object.isFrozen(firstExam));
		assert.ok(Object.isFrozen(firstExam?.questions));
		assert.ok(Object.isFrozen(slides));
		assert.ok(Object.isFrozen(slides[0]));
		assert.ok(Object.isFrozen(slideOnlyUnits));
		assert.ok(Object.isFrozen(unitBasedTabs));
		assert.ok(Object.isFrozen(unitBasedTabs[0]?.examMapping));
	});

	it("getExamByNumber returns the matching group", async () => {
		const examByYear = await getExamByNumber(9);

		assert.equal(examByYear?.examNumber, 9);
		assert.deepEqual(examByYear?.availableYears, ["2013", "2014"]);
	});

	it("getExamByNumber resolves every meta-declared exam number", async () => {
		const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
		const results = await Promise.all(numbers.map((number) => getExamByNumber(number)));

		assert.ok(results.every((result) => result !== undefined));
		assert.deepEqual(
			results.map((result) => result?.examNumber),
			[...numbers],
		);
	});
});

describe("selectVisibleExamNumbers", () => {
	const integrated = {
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
	};

	it("真部分集合の候補を除外する（統合 exam ⊇ 原本 exam）", () => {
		const candidates = [
			integrated,
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

		assert.deepEqual(selectVisibleExamNumbers(candidates), [4]);
	});

	it("完全一致は番号が小さい方を残す", () => {
		const ids = [
			"exam8-2016-q1",
			"exam8-2016-q2",
			"exam8-2016-q3",
			"exam8-2016-q4",
			"exam8-2016-q5",
		];
		const candidates = [
			{ examNumber: 5, questionIds: ids },
			{ examNumber: 8, questionIds: [...ids] },
		];

		assert.deepEqual(selectVisibleExamNumbers(candidates), [5]);
	});

	it("互いに素な候補は全て残す", () => {
		const candidates = [
			{ examNumber: 5, questionIds: ["exam5-q1", "exam5-q2"] },
			{ examNumber: 6, questionIds: ["exam6-q1", "exam6-q2"] },
		];

		assert.deepEqual(selectVisibleExamNumbers(candidates), [5, 6]);
	});

	it("候補が単一の場合はそのまま返す", () => {
		assert.deepEqual(selectVisibleExamNumbers([{ examNumber: 1, questionIds: ["exam1-q1"] }]), [1]);
	});
});

describe("exams loader schema validation (rejection path)", () => {
	const baseValidExam = {
		id: "exam1-2013",
		number: 1,
		title: "テスト試験",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test.pdf",
		answerPdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/test-answer.pdf",
		questions: [{ id: "exam1-2013-q1", number: 1, text: "問題文", answer: "ア" }],
	};

	it("accepts a well-formed exam object", () => {
		const parsed = safeParseOrThrow(ExamJsonSchema, baseValidExam, "valid");
		assert.equal(parsed.id, "exam1-2013");
	});

	it("rejects an exam with a malformed id", () => {
		assert.throws(() =>
			safeParseOrThrow(ExamJsonSchema, { ...baseValidExam, id: "not-an-exam-id" }, "bad id"),
		);
	});

	it("rejects an exam with examNumber out of range", () => {
		assert.throws(() => safeParseOrThrow(ExamJsonSchema, { ...baseValidExam, number: 99 }, "bad"));
	});

	it("rejects an exam missing required questions field", () => {
		const { questions: _omitted, ...bad } = baseValidExam;
		assert.throws(() => safeParseOrThrow(ExamJsonSchema, bad, "missing questions"));
	});

	it("rejects a pdfPath outside the 明治 配信 base", () => {
		assert.throws(() =>
			safeParseOrThrow(
				ExamJsonSchema,
				{ ...baseValidExam, pdfPath: "https://evil.example.com/test.pdf" },
				"bad pdf path",
			),
		);
	});
});
