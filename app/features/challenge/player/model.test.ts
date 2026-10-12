import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { QuestionSchema } from "../../../data/exams/schema.ts";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../../types/browser.ts";
import { ExamNumberSchema, UnitTabIdSchema, YearSchema } from "../../../types/domain.ts";
import { createInitialChallengeState } from "../model.ts";
import type { ChallengeState, CompletedChallengePayload } from "../types.ts";
import {
	countJudgments,
	createPlayerChallenge,
	filterChallengeHistory,
	getNavigationPosition,
	isModeEntryTarget,
	questionScopeKey,
} from "./model.ts";
import type { ExamPlayerProps, PlayerQuestion } from "./types.ts";

const examId = ExamIdSchema.parse("exam1-2013");
const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const q3 = QuestionIdSchema.parse("exam1-2013-q3");
const challengeId = ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const questions: readonly PlayerQuestion[] = [q1, q2, q3].map((id, index) =>
	QuestionSchema.parse({ id, number: index + 1, text: `問題${index + 1}`, answer: "ア" }),
);

function props(
	mode: ExamPlayerProps["mode"],
	requestedQuestionId?: ExamPlayerProps["requestedQuestionId"],
): ExamPlayerProps {
	return {
		examId,
		examNumber: ExamNumberSchema.parse(1),
		year: YearSchema.parse("2013"),
		unitId: UnitTabIdSchema.parse("unit-base-conversion"),
		playerTitle: "テスト",
		questions,
		mode,
		requestedQuestionId,
	};
}

function state(currentIndex = 0): ChallengeState {
	return createInitialChallengeState({
		challengeId,
		scopeKey: "exam1-2013/exam",
		examId,
		mode: "exam",
		questionIds: [q1, q2],
		createdAt: 1_700_000_000_000,
		initialIndex: currentIndex,
	});
}

function payload(
	challenge: string,
	answers: CompletedChallengePayload["answers"],
): CompletedChallengePayload {
	return {
		challengeId: challenge as CompletedChallengePayload["challengeId"],
		examId,
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_100,
		answers,
	};
}

describe("player model", () => {
	// @lat: [[testing#Challenge client and player#Exam and single-question player scopes]]
	it("exam mode clamps the requested index and retains the full question scope", () => {
		const result = createPlayerChallenge(
			props("exam"),
			questions,
			"exam1-2013/exam",
			99,
			undefined,
			() => 0,
			challengeId,
			1_700_000_000_000,
		);

		assert.equal(result?.question.id, q3);
		assert.deepEqual(result?.state.questionIds, [q1, q2, q3]);
		assert.equal(result?.state.currentIndex, 2);
		assert.equal(result?.state.scopeKey, "exam1-2013/exam");
	});

	it("question mode starts at its requested question with a question-specific scope", () => {
		const result = createPlayerChallenge(
			props("question", q2),
			questions,
			"exam1-2013/exam",
			undefined,
			q2,
			(questionId) => questions.findIndex((question) => question.id === questionId),
			challengeId,
			1_700_000_000_000,
		);

		assert.equal(result?.question.id, q2);
		assert.deepEqual(result?.state.questionIds, [q2]);
		assert.equal(result?.state.currentIndex, 0);
		assert.equal(result?.state.scopeKey, "exam1-2013/question/exam1-2013-q2");
	});

	it("returns no player challenge when the exam has no questions", () => {
		const result = createPlayerChallenge(
			props("exam"),
			[],
			"exam1-2013/exam",
			undefined,
			undefined,
			() => 0,
			challengeId,
			1_700_000_000_000,
		);

		assert.equal(result, null);
	});

	it("counts recorded judgments and distinguishes entry targets by mode", () => {
		const judged: ChallengeState = {
			...state(),
			judgments: { [q1]: "correct", [q2]: "incorrect" },
		};

		assert.equal(countJudgments(judged), 2);
		assert.equal(isModeEntryTarget("exam", q2, undefined, 0), true);
		assert.equal(isModeEntryTarget("exam", q2, undefined, 1), false);
		assert.equal(isModeEntryTarget("question", q2, q2, 1), true);
		assert.equal(isModeEntryTarget("question", q1, q2, 0), false);
		assert.equal(questionScopeKey(examId, "question"), "exam1-2013/question/");
	});

	it("filters exam history from one-question history without mixing scopes", () => {
		const answer = {
			questionId: q1,
			elapsedMs: 1000,
			judgment: "correct" as const,
			createdAt: 1_700_000_000_050,
			updatedAt: 1_700_000_000_100,
		};
		const examAttempt = payload("550e8400-e29b-41d4-a716-446655440000", [
			answer,
			{ ...answer, questionId: q2 },
		]);
		const q1Attempt = payload("550e8400-e29b-41d4-a716-446655440001", [answer]);
		const q2Attempt = payload("550e8400-e29b-41d4-a716-446655440002", [
			{ ...answer, questionId: q2 },
		]);

		assert.deepEqual(filterChallengeHistory([examAttempt, q1Attempt, q2Attempt], examId, "exam"), [
			examAttempt,
		]);
		assert.deepEqual(
			filterChallengeHistory([examAttempt, q1Attempt, q2Attempt], examId, "question", q1),
			[q1Attempt],
		);
	});

	it("uses attempt position for exam navigation and catalog position for question navigation", () => {
		const attempt = state(1);
		const getQuestionIndex = (questionId?: string): number =>
			questions.findIndex((question) => question.id === questionId);

		assert.deepEqual(getNavigationPosition("exam", q2, attempt, questions, getQuestionIndex), {
			currentQuestionIndex: 1,
			navigationLength: 2,
		});
		assert.deepEqual(getNavigationPosition("question", q2, attempt, questions, getQuestionIndex), {
			currentQuestionIndex: 1,
			navigationLength: 3,
		});
	});
});
