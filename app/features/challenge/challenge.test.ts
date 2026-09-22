import { describe, expect, it } from "vitest";
import type { QuestionId } from "../../types";
import {
	aggregateChallengeResults,
	applyElapsedDelta,
	calculateElapsedDelta,
	challengeReducer,
	createInitialChallengeState,
	toCompletedChallengePayload,
} from "./challenge";
import type { ChallengeState, CompletedChallengePayload } from "./types";

const q1 = "exam1-2013-q1" as QuestionId;
const q2 = "exam1-2013-q2" as QuestionId;

function initialState(): ChallengeState {
	return createInitialChallengeState({
		challengeId: "challenge-1",
		scopeKey: "exam1-2013/exam",
		examId: "exam1-2013",
		mode: "exam",
		questionIds: [q1, q2],
		createdAt: 1_700_000_000_000,
	});
}

function payload(
	challengeId: string,
	answers: CompletedChallengePayload["answers"],
): CompletedChallengePayload {
	return {
		challengeId,
		examId: "exam1-2013",
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_100,
		answers,
	};
}

describe("challenge core", () => {
	it("可視時間の差分は負値と極端な値を加算しない", () => {
		const runtime = { running: true, lastSample: 100, currentQuestionId: q1 } as const;
		expect(calculateElapsedDelta(runtime, 350)).toBe(250);
		expect(calculateElapsedDelta(runtime, 50)).toBe(0);
		expect(calculateElapsedDelta(runtime, 24 * 60 * 60 * 1000 + 101)).toBe(0);
	});

	it("revealと判定は既存状態を変更せず、判定を一度だけ確定する", () => {
		const state = initialState();
		const revealed = challengeReducer(state, { type: "REVEAL_QUESTION", questionId: q1 });
		const judged = challengeReducer(revealed, {
			type: "JUDGE_QUESTION",
			questionId: q1,
			judgment: "correct",
			answerCreatedAt: 1_700_000_000_010,
		});
		const doubleClick = challengeReducer(judged, {
			type: "JUDGE_QUESTION",
			questionId: q1,
			judgment: "incorrect",
			answerCreatedAt: 1_700_000_000_020,
		});

		expect(state.revealedQuestionIds.size).toBe(0);
		expect(state.judgments[q1]).toBeUndefined();
		expect(judged.judgments[q1]).toBe("correct");
		expect(doubleClick).toBe(judged);
		expect(doubleClick.answerCreatedAt[q1]).toBe(1_700_000_000_010);
	});

	it("問題を戻った場合も各問題の時間を累積する", () => {
		let state = initialState();
		state = applyElapsedDelta(state, q1, 1000);
		state = challengeReducer(state, { type: "MOVE_TO", index: 1 });
		state = applyElapsedDelta(state, q2, 2000);
		state = challengeReducer(state, { type: "MOVE_TO", index: 0 });
		state = applyElapsedDelta(state, q1, 3000);

		expect(state.questionElapsedMs[q1]).toBe(4000);
		expect(state.questionElapsedMs[q2]).toBe(2000);
	});

	it("完了時刻をすべてのanswers.updatedAtへ揃える", () => {
		let state = challengeReducer(initialState(), { type: "REVEAL_QUESTION", questionId: q1 });
		state = challengeReducer(state, {
			type: "JUDGE_QUESTION",
			questionId: q1,
			judgment: "correct",
			answerCreatedAt: 1_700_000_000_010,
		});
		state = challengeReducer(state, { type: "REVEAL_QUESTION", questionId: q2 });
		state = challengeReducer(state, {
			type: "JUDGE_QUESTION",
			questionId: q2,
			judgment: "incorrect",
			answerCreatedAt: 1_700_000_000_020,
		});

		const completed = toCompletedChallengePayload(state, 1_700_000_000_100);
		expect(completed?.answers.every((answer) => answer.updatedAt === 1_700_000_000_100)).toBe(true);
	});

	it("総合正解率は試行ごとの率ではなく判定数で重み付けする", () => {
		const first = payload("challenge-1", [
			{
				questionId: q1,
				elapsedMs: 1000,
				judgment: "correct",
				createdAt: 1_700_000_000_010,
				updatedAt: 1_700_000_000_100,
			},
		]);
		const second = payload("challenge-2", [
			{ ...first.answers[0], questionId: q1, judgment: "incorrect" },
			{ ...first.answers[0], questionId: q2, judgment: "incorrect" },
		]);
		const result = aggregateChallengeResults([first, second]);

		expect(result.challengeCount).toBe(2);
		expect(result.judgedCount).toBe(3);
		expect(result.correctCount).toBe(1);
		expect(result.accuracy).toBeCloseTo(1 / 3);
	});
});
