import type { QuestionId, UnitTabId, Year } from "../../../types";

export function replaceChallengeView(view: "player" | "result", challengeId?: string): void {
	const url = new URL(window.location.href);
	if (view === "result" && challengeId) {
		url.searchParams.set("view", "result");
		url.searchParams.set("challenge", challengeId);
	} else {
		url.searchParams.delete("view");
		url.searchParams.delete("challenge");
	}
	window.history.replaceState(null, "", url);
}

export function replaceQuestionInUrl(questionId: QuestionId): void {
	const url = new URL(window.location.href);
	url.searchParams.set("question", questionId);
	window.history.replaceState(null, "", url);
}

export function navigateToExam(unitId: UnitTabId, year: Year): void {
	window.location.href = `/${unitId}/${year}`;
}
