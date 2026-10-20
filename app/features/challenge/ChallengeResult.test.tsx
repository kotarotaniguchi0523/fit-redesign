import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionSchema } from "../../data/exams/schema";
import { QuestionIdSchema } from "../../types/browser";
import { ChallengeResult } from "./ChallengeResult";
import type { CompletedChallengePayload } from "./types";

const q1 = QuestionIdSchema.parse("exam1-2013-q1");
const q2 = QuestionIdSchema.parse("exam1-2013-q2");
const questions = [
	QuestionSchema.parse({ id: q1, number: 1, text: "問題1", answer: "ア" }),
	QuestionSchema.parse({ id: q2, number: 2, text: "問題2", answer: "イ" }),
];
const current: CompletedChallengePayload = {
	challengeId: "550e8400-e29b-41d4-a716-446655440000",
	examId: "exam1-2013",
	createdAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_200,
	answers: [
		{
			questionId: q1,
			elapsedMs: 2500,
			judgment: "correct",
			createdAt: 1_700_000_000_100,
			updatedAt: 1_700_000_000_200,
		},
	],
};
const previous: CompletedChallengePayload = {
	...current,
	challengeId: "550e8400-e29b-41d4-a716-446655440001",
	answers: [
		{
			questionId: q2,
			elapsedMs: 1500,
			judgment: "incorrect",
			createdAt: 1_700_000_000_150,
			updatedAt: 1_700_000_000_200,
		},
	],
};

function noop(): void {}

afterEach(() => {
	document.body.replaceChildren();
});

describe("ChallengeResult", () => {
	// @lat: [[testing#Challenge client and player#Result views show mode-specific summaries and actions]]
	it("shows current and historical exam results and invokes both actions", () => {
		const onRetry = vi.fn();
		const onBack = vi.fn();
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<ChallengeResult
				payload={current}
				history={[previous, current]}
				questions={questions}
				mode="exam"
				onRetry={onRetry}
				onBack={onBack}
				syncMessage="同期できませんでした"
			/>,
			container,
		);

		const visibleText = container.textContent ?? "";
		expect(visibleText).toContain("小テストの結果");
		expect(visibleText).toContain("今回の問題別結果");
		expect(visibleText).toContain("これまでの結果");
		expect(visibleText).toContain("1 / 1");
		expect(visibleText).toContain("100%");
		expect(visibleText).toContain("同期できませんでした");
		const buttons = Array.from(container.querySelectorAll("button"));
		buttons.find((button) => button.textContent?.trim() === "問題一覧")?.click();
		buttons.find((button) => button.textContent?.trim() === "もう一度挑戦")?.click();

		expect(onBack).toHaveBeenCalledOnce();
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("uses single-question labels and shows an empty-history accuracy state", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<ChallengeResult
				payload={current}
				history={[]}
				questions={questions}
				mode="question"
				onRetry={noop}
				onBack={noop}
				syncMessage={null}
			/>,
			container,
		);

		const visibleText = container.textContent ?? "";
		expect(visibleText).toContain("タイムアタックの結果");
		expect(visibleText).toContain("計測時間");
		expect(visibleText).toContain("この問題の結果");
		expect(visibleText).toContain("これまでの計測");
		expect(visibleText).toContain("もう一度計測");
		expect(visibleText).toContain("—");
		expect(container.querySelector('[role="status"]')).toBeNull();
	});
});
