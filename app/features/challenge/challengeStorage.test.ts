import { afterEach, describe, expect, it, vi } from "vitest";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../types/browser";
import { challengeReducer, createInitialChallengeState } from "./challenge";
import {
	archiveCompletedChallenge,
	CHALLENGE_HISTORY_STORAGE_KEY,
	readChallengeHistory,
} from "./challengeStorage";
import type { ChallengeState } from "./types";

const questionId = QuestionIdSchema.parse("exam1-2013-q1");
const timestamp = 1_700_000_000_000;

function completedState(): ChallengeState {
	const initial = createInitialChallengeState({
		challengeId: ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000"),
		scopeKey: "exam1-2013/exam",
		examId: ExamIdSchema.parse("exam1-2013"),
		mode: "exam",
		questionIds: [questionId],
		createdAt: timestamp,
	});
	const revealed = challengeReducer(initial, { type: "REVEAL_QUESTION", questionId });
	const judged = challengeReducer(revealed, {
		type: "JUDGE_QUESTION",
		questionId,
		judgment: "correct",
		answerCreatedAt: timestamp + 1,
	});
	return judged;
}

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe("challengeStorage validation", () => {
	it("rejects snapshots whose judgment and timestamp maps disagree", () => {
		localStorage.setItem(
			CHALLENGE_HISTORY_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				challengeId: "550e8400-e29b-41d4-a716-446655440000",
				scopeKey: "exam1-2013/exam",
				examId: "exam1-2013",
				mode: "exam",
				questionIds: [questionId],
				createdAt: timestamp,
				updatedAt: timestamp + 2,
				currentIndex: 0,
				revealedQuestionIds: [questionId],
				judgments: { [questionId]: "correct" },
				answerCreatedAt: {},
				questionElapsedMs: {},
				status: "completed",
			}),
		);
		expect(readChallengeHistory()).toEqual([]);
	});

	it("returns the completed result even when history persistence fails", () => {
		const original = Storage.prototype.setItem;
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
			if (key === CHALLENGE_HISTORY_STORAGE_KEY) {
				throw new DOMException("quota", "QuotaExceededError");
			}
			original.call(this, key, value);
		});
		const result = archiveCompletedChallenge(completedState(), timestamp + 2);
		expect(result?.payload.answers).toHaveLength(1);
		expect(result?.persisted).toBe(false);
	});
});
