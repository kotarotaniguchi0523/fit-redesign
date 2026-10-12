import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import type { ChallengeId } from "../../types/browser.ts";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../types/browser.ts";
import {
	aggregateChallengeResults,
	applyElapsedDelta,
	calculateElapsedDelta,
	challengeReducer,
	createInitialChallengeState,
	toCompletedChallengePayload,
} from "./challenge.ts";
import type { ChallengeState, CompletedChallengePayload } from "./types.ts";

const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const challenge1 = ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const challenge2 = ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440001");

function initialState(): ChallengeState {
	return createInitialChallengeState({
		challengeId: challenge1,
		scopeKey: "exam1-2013/exam",
		examId: ExamIdSchema.parse("exam1-2013"),
		mode: "exam",
		questionIds: [q1, q2],
		createdAt: 1_700_000_000_000,
	});
}

function payload(
	challengeId: ChallengeId,
	answers: CompletedChallengePayload["answers"],
): CompletedChallengePayload {
	return {
		challengeId,
		examId: ExamIdSchema.parse("exam1-2013"),
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_100,
		answers,
	};
}

describe("challenge core", () => {
	it("可視時間の差分は負値と極端な値を加算しない", () => {
		const runtime = { running: true, lastSample: 100, currentQuestionId: q1 } as const;
		assert.equal(calculateElapsedDelta(runtime, 350), 250);
		assert.equal(calculateElapsedDelta(runtime, 50), 0);
		assert.equal(calculateElapsedDelta(runtime, 24 * 60 * 60 * 1000 + 101), 0);
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

		assert.equal(state.revealedQuestionIds.size, 0);
		assert.equal(state.judgments[q1], undefined);
		assert.equal(judged.judgments[q1], "correct");
		assert.equal(doubleClick, judged);
		assert.equal(doubleClick.answerCreatedAt[q1], 1_700_000_000_010);
	});

	it("問題を戻った場合も各問題の時間を累積する", () => {
		let state = initialState();
		state = applyElapsedDelta(state, q1, 1000);
		state = challengeReducer(state, { type: "MOVE_TO", index: 1 });
		state = applyElapsedDelta(state, q2, 2000);
		state = challengeReducer(state, { type: "MOVE_TO", index: 0 });
		state = applyElapsedDelta(state, q1, 3000);

		assert.equal(state.questionElapsedMs[q1], 4000);
		assert.equal(state.questionElapsedMs[q2], 2000);
	});

	it("完了時刻をすべてのanswers.updatedAtへ揃える", () => {
		let state: ChallengeState = challengeReducer(initialState(), {
			type: "REVEAL_QUESTION",
			questionId: q1,
		});
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

		state = challengeReducer(state as never, {
			type: "COMPLETE",
			updatedAt: 1_700_000_000_100,
		}) as typeof state;
		const completed = toCompletedChallengePayload(state as never, 1_700_000_000_100);
		assert.equal(
			completed?.answers.every((answer) => answer.updatedAt === 1_700_000_000_100),
			true,
		);
	});

	it("総合正解率は試行ごとの率ではなく判定数で重み付けする", () => {
		const first = payload(challenge1, [
			{
				questionId: q1,
				elapsedMs: 1000,
				judgment: "correct",
				createdAt: 1_700_000_000_010,
				updatedAt: 1_700_000_000_100,
			},
		]);
		const second = payload(challenge2, [
			{ ...first.answers[0], questionId: q1, judgment: "incorrect" },
			{ ...first.answers[0], questionId: q2, judgment: "incorrect" },
		]);
		const result = aggregateChallengeResults([first, second]);

		assert.equal(result.challengeCount, 2);
		assert.equal(result.judgedCount, 3);
		assert.equal(result.correctCount, 1);
		assert.ok(Math.abs((result.accuracy as number) - 1 / 3) < 1e-6);
	});

	it("完了後の試行状態は変更できない", () => {
		let state = initialState();
		for (const [index, questionId] of [q1, q2].entries()) {
			state = challengeReducer(state, { type: "REVEAL_QUESTION", questionId });
			state = challengeReducer(state, {
				type: "JUDGE_QUESTION",
				questionId,
				judgment: "correct",
				answerCreatedAt: 1_700_000_000_010 + index,
			});
		}
		const completed = challengeReducer(state, {
			type: "COMPLETE",
			updatedAt: 1_700_000_000_100,
		});

		assert.equal(
			challengeReducer(completed, { type: "APPLY_ELAPSED", questionId: q1, deltaMs: 500 }),
			completed,
		);
	});
});
