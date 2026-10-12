import { afterEach, describe, expect, it, vi } from "vitest";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../types/browser";
import { challengeReducer, createInitialChallengeState } from "./challenge";
import {
	archiveCompletedChallenge,
	CHALLENGE_HISTORY_STORAGE_KEY,
	findActiveChallenge,
	findChallenge,
	hasActiveChallengeLock,
	markActiveChallengeIncomplete,
	readActiveChallenges,
	readChallengeHistory,
	readCompletedChallenges,
	releaseChallengeLock,
	renewChallengeLock,
	saveActiveChallenge,
	tryAcquireChallengeLock,
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
	vi.useRealTimers();
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

	// @lat: [[testing#Challenge client and player#Active attempts become restorable completed history]]
	it("restores an active attempt and moves its completed result into history", () => {
		const state = completedState();
		expect(saveActiveChallenge(state)).toBe(true);
		expect(findActiveChallenge(state.scopeKey)).toMatchObject({
			challengeId: state.challengeId,
			status: "active",
		});

		const archived = archiveCompletedChallenge(state, timestamp + 2);

		expect(archived?.persisted).toBe(true);
		expect(readActiveChallenges()).toEqual({});
		expect(readCompletedChallenges()).toEqual([archived?.payload]);
		expect(findChallenge(state.challengeId)?.status).toBe("completed");
	});

	it("keeps an abandoned attempt out of completed results", () => {
		const state = completedState();
		expect(saveActiveChallenge(state)).toBe(true);

		expect(markActiveChallengeIncomplete(state)).toBe(true);

		expect(findActiveChallenge(state.scopeKey)).toBeUndefined();
		expect(readChallengeHistory()).toMatchObject([{ status: "incomplete" }]);
		expect(readCompletedChallenges()).toEqual([]);
	});
});

describe("challenge locks", () => {
	it("keeps ownership isolated and removes only the released lock", () => {
		const firstChallenge = "challenge-one";
		const secondChallenge = "challenge-two";

		expect(tryAcquireChallengeLock(firstChallenge, "owner-one")).toBe(true);
		expect(tryAcquireChallengeLock(firstChallenge, "owner-two")).toBe(false);
		expect(tryAcquireChallengeLock(secondChallenge, "owner-two")).toBe(true);
		expect(releaseChallengeLock(firstChallenge, "owner-two")).toBe(true);
		expect(hasActiveChallengeLock(firstChallenge, "owner-two")).toBe(true);

		expect(releaseChallengeLock(firstChallenge, "owner-one")).toBe(true);
		expect(hasActiveChallengeLock(firstChallenge, "owner-two")).toBe(false);
		expect(hasActiveChallengeLock(secondChallenge, "owner-one")).toBe(true);
	});

	// @lat: [[testing#Challenge client and player#Timer locks remain owner-scoped until their heartbeat expires]]
	it("renews a lock only for its owner and expires it after the heartbeat window", () => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		const challengeId = "challenge-renewal";
		expect(tryAcquireChallengeLock(challengeId, "owner-one")).toBe(true);

		vi.setSystemTime(20_000);
		expect(renewChallengeLock(challengeId, "owner-two")).toBe(false);
		expect(renewChallengeLock(challengeId, "owner-one")).toBe(true);
		vi.setSystemTime(34_000);
		expect(hasActiveChallengeLock(challengeId, "owner-two")).toBe(true);
		vi.setSystemTime(35_001);
		expect(hasActiveChallengeLock(challengeId, "owner-two")).toBe(false);
	});

	it("allows a different owner to acquire a lock after it expires", () => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		const challengeId = "challenge-expired";
		expect(tryAcquireChallengeLock(challengeId, "owner-one")).toBe(true);

		vi.setSystemTime(25_001);

		expect(tryAcquireChallengeLock(challengeId, "owner-two")).toBe(true);
		expect(hasActiveChallengeLock(challengeId, "owner-one")).toBe(true);
	});
});
