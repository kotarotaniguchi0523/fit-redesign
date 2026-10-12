import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionSchema } from "../../data/exams/schema";
import { ChallengeIdSchema, ExamIdSchema, QuestionIdSchema } from "../../types/browser";
import { ExamNumberSchema, UnitTabIdSchema, YearSchema } from "../../types/domain";
import ExamPlayer from "./$ExamPlayer";
import { createInitialChallengeState } from "./challenge";
import {
	ACTIVE_CHALLENGES_STORAGE_KEY,
	CHALLENGE_LOCKS_STORAGE_KEY,
	saveActiveChallenge,
} from "./challengeStorage";
import type { ExamPlayerProps, PlayerQuestion } from "./player/types";

const examId = ExamIdSchema.parse("exam1-2013");
const challengeId = ChallengeIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const questions: readonly PlayerQuestion[] = [q1, q2].map((id, index) =>
	QuestionSchema.parse({ id, number: index + 1, text: `問題${index + 1}`, answer: "ア" }),
);

const props: ExamPlayerProps = {
	examId,
	examNumber: ExamNumberSchema.parse(1),
	year: YearSchema.parse("2013"),
	unitId: UnitTabIdSchema.parse("unit-base-conversion"),
	playerTitle: "小テスト1",
	questions,
	mode: "exam",
};

afterEach(() => {
	document.body.replaceChildren();
	localStorage.clear();
	vi.clearAllTimers();
	vi.useRealTimers();
	window.history.replaceState({}, "", "/unit-base-conversion/2013/exam/1");
});

describe("ExamPlayer lifecycle effects", () => {
	// @lat: [[testing#Challenge client and player#Mounted player effects commit storage and resume the timer]]
	it("persists a new attempt and takes its lock after the first client render", async () => {
		vi.useFakeTimers();
		const container = document.createElement("div");
		document.body.appendChild(container);

		render(<ExamPlayer {...props} />, container);

		expect(container.querySelector(".exam-player-shell")?.getAttribute("aria-busy")).toBe("false");
		expect(localStorage.getItem(ACTIVE_CHALLENGES_STORAGE_KEY)).not.toBeNull();
		expect(
			Object.keys(JSON.parse(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY) ?? "{}")),
		).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(16);
		window.dispatchEvent(new Event("pagehide"));
		expect(
			Object.keys(JSON.parse(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY) ?? "{}")),
		).toHaveLength(0);
	});

	// @lat: [[testing#Challenge client and player#Mounted player effects commit storage and resume the timer]]
	it("starts the restored timer when continuing an attempt", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
		const state = createInitialChallengeState({
			challengeId,
			scopeKey: "exam1-2013/exam",
			examId,
			mode: "exam",
			questionIds: [q1, q2],
			createdAt: 1_700_000_000_000,
		});
		saveActiveChallenge(state);
		const container = document.createElement("div");
		document.body.appendChild(container);

		render(<ExamPlayer {...props} />, container);
		expect(container.textContent).toContain("続きがあります");
		expect(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY)).toBeNull();

		const continueButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("続きから"),
		);
		continueButton?.click();
		await vi.advanceTimersByTimeAsync(0);

		const elapsedTime = container.querySelector('[data-testid="challenge-question-time"]');
		expect(elapsedTime).not.toBeNull();
		const before = elapsedTime?.textContent;
		expect(
			Object.keys(JSON.parse(localStorage.getItem(CHALLENGE_LOCKS_STORAGE_KEY) ?? "{}")),
		).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(1200);

		expect(elapsedTime?.textContent).not.toBe(before);
	});
});
