import { describe, expect, it } from "vitest";
import { QuestionIdSchema } from "../../../types/browser";
import { type MutableTimerRuntime, resetTimerRuntimeInPlace } from "./timerRuntime";

const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");

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
