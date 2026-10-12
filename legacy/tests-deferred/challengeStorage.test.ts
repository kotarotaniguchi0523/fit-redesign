import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { installBrowserShims } from '../../test/browser-shims.ts'

installBrowserShims()
// TODO: convert vi.* usage to `t.mock.*`

import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../types/browser.ts";
import { challengeReducer, createInitialChallengeState } from "./challenge.ts";
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
} from "./challengeStorage.ts";
import type { ChallengeState } from "./types.ts";

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
		assert.deepEqual(readChallengeHistory(), []);
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
		assert.equal((result?.payload.answers).length, 1);
		assert.equal(result?.persisted, false);
	});

	// @lat: [[testing#Challenge client and player#Active attempts become restorable completed history]]
	it("restores an active attempt and moves its completed result into history", () => {
		const state = completedState();
		assert.equal(saveActiveChallenge(state), true);
		expect(findActiveChallenge(state.scopeKey)).toMatchObject({
			challengeId: state.challengeId,
			status: "active",
		});

		const archived = archiveCompletedChallenge(state, timestamp + 2);

		assert.equal(archived?.persisted, true);
		assert.deepEqual(readActiveChallenges(), {});
		assert.deepEqual(readCompletedChallenges(), [archived?.payload]);
		assert.equal(findChallenge(state.challengeId)?.status, "completed");
	});

	it("keeps an abandoned attempt out of completed results", () => {
		const state = completedState();
		assert.equal(saveActiveChallenge(state), true);

		assert.equal(markActiveChallengeIncomplete(state), true);

		assert.equal(findActiveChallenge(state.scopeKey), undefined);
		expect(readChallengeHistory()).toMatchObject([{ status: "incomplete" }]);
		assert.deepEqual(readCompletedChallenges(), []);
	});
});

describe("challenge locks", () => {
	it("keeps ownership isolated and removes only the released lock", () => {
		const firstChallenge = "challenge-one";
		const secondChallenge = "challenge-two";

		assert.equal(tryAcquireChallengeLock(firstChallenge, "owner-one"), true);
		assert.equal(tryAcquireChallengeLock(firstChallenge, "owner-two"), false);
		assert.equal(tryAcquireChallengeLock(secondChallenge, "owner-two"), true);
		assert.equal(releaseChallengeLock(firstChallenge, "owner-two"), true);
		assert.equal(hasActiveChallengeLock(firstChallenge, "owner-two"), true);

		assert.equal(releaseChallengeLock(firstChallenge, "owner-one"), true);
		assert.equal(hasActiveChallengeLock(firstChallenge, "owner-two"), false);
		assert.equal(hasActiveChallengeLock(secondChallenge, "owner-one"), true);
	});

	// @lat: [[testing#Challenge client and player#Timer locks remain owner-scoped until their heartbeat expires]]
	it("renews a lock only for its owner and expires it after the heartbeat window", () => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		const challengeId = "challenge-renewal";
		assert.equal(tryAcquireChallengeLock(challengeId, "owner-one"), true);

		vi.setSystemTime(20_000);
		assert.equal(renewChallengeLock(challengeId, "owner-two"), false);
		assert.equal(renewChallengeLock(challengeId, "owner-one"), true);
		vi.setSystemTime(34_000);
		assert.equal(hasActiveChallengeLock(challengeId, "owner-two"), true);
		vi.setSystemTime(35_001);
		assert.equal(hasActiveChallengeLock(challengeId, "owner-two"), false);
	});

	it("allows a different owner to acquire a lock after it expires", () => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		const challengeId = "challenge-expired";
		assert.equal(tryAcquireChallengeLock(challengeId, "owner-one"), true);

		vi.setSystemTime(25_001);

		assert.equal(tryAcquireChallengeLock(challengeId, "owner-two"), true);
		assert.equal(hasActiveChallengeLock(challengeId, "owner-one"), true);
	});
});
