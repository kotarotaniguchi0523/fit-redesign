import { describe, expect, it } from "vitest";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../../types/browser";
import { createInitialChallengeState } from "../challenge";
import {
	type MutableTimerRuntime,
	projectElapsedTime,
	resetTimerRuntimeInPlace,
	sampleChallengeTimer,
} from "./timerRuntime";

const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const initialState = createInitialChallengeState({
	challengeId: ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000"),
	scopeKey: "exam1-2013/exam",
	examId: ExamIdSchema.parse("exam1-2013"),
	mode: "exam",
	questionIds: [q1, q2],
	createdAt: 1_700_000_000_000,
});

describe("timer runtime reset", () => {
	// @lat: [[testing#Challenge client and player#Timer reset clears sampling and changes the active question]]
	it("stops sampling and switches the active question", () => {
		const runtime: MutableTimerRuntime = {
			running: true,
			lastSample: 1234,
			currentQuestionId: q1,
		};

		resetTimerRuntimeInPlace(runtime, q2);

		expect(runtime).toEqual({ running: false, lastSample: null, currentQuestionId: q2 });
	});

	it("keeps the active question when reset without a next question", () => {
		const runtime: MutableTimerRuntime = {
			running: true,
			lastSample: 1234,
			currentQuestionId: q1,
		};

		resetTimerRuntimeInPlace(runtime, undefined);

		expect(runtime).toEqual({ running: false, lastSample: null, currentQuestionId: q1 });
	});
});

describe("timer display projection", () => {
	// @lat: [[testing#Challenge client and player#Timer display projects elapsed time independently of player state]]
	it("projects the current elapsed value from the last persisted sample", () => {
		expect(projectElapsedTime(5000, true, 1000, 3500)).toBe(7500);
		expect(projectElapsedTime(5000, false, 1000, 3500)).toBe(5000);
	});

	// @lat: [[testing#Challenge client and player#Timer display projects elapsed time independently of player state]]
	it("does not project invalid or out-of-range clock deltas", () => {
		expect(projectElapsedTime(5000, true, 2000, 1000)).toBe(5000);
		expect(projectElapsedTime(5000, true, 0, 24 * 60 * 60 * 1000 + 1)).toBe(5000);
	});
});

describe("timer samples", () => {
	// @lat: [[testing#Challenge client and player#Elapsed samples accumulate without a player render]]
	it("accumulates elapsed state at each persistence sample", () => {
		const runtime: MutableTimerRuntime = {
			running: true,
			lastSample: 1000,
			currentQuestionId: q1,
		};

		const first = sampleChallengeTimer(initialState, runtime, 3000);
		const second = sampleChallengeTimer(first.state, runtime, 5000);

		expect(first.deltaMs).toBe(2000);
		expect(second.deltaMs).toBe(2000);
		expect(second.state.questionElapsedMs[q1]).toBe(4000);
		expect(runtime.lastSample).toBe(5000);
	});
});
