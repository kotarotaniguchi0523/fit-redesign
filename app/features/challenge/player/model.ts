import type { ChallengeId, QuestionId } from "../../../types";
import { createInitialChallengeState } from "../challenge";
import type { ChallengeState, CompletedChallengePayload } from "../types";
import type { ExamPlayerProps, PlayerMode, PlayerQuestion } from "./types";

export function createPlayerChallenge(
	props: ExamPlayerProps,
	questions: readonly PlayerQuestion[],
	scopeKey: string,
	requestedIndex: number | undefined,
	activeQuestionId: QuestionId | undefined,
	getQuestionIndex: (questionId?: QuestionId) => number,
	challengeId: ChallengeId,
	createdAt: number,
): Readonly<{ state: ChallengeState; question: PlayerQuestion }> | null {
	const requestedQuestionIndex =
		requestedIndex ??
		(props.mode === "question"
			? getQuestionIndex(activeQuestionId ?? props.requestedQuestionId)
			: 0);
	const initialIndex = Math.min(
		Math.max(requestedQuestionIndex, 0),
		Math.max(questions.length - 1, 0),
	);
	const question = questions[initialIndex] ?? questions[0];
	if (!question) {
		return null;
	}
	const questionIds = props.mode === "question" ? [question.id] : questions.map((item) => item.id);
	const challengeScopeKey =
		props.mode === "question" ? questionScopeKey(props.examId, props.mode, question.id) : scopeKey;
	const state = createInitialChallengeState({
		challengeId,
		scopeKey: challengeScopeKey,
		examId: props.examId,
		mode: props.mode,
		questionIds,
		createdAt,
		initialIndex: props.mode === "question" ? 0 : initialIndex,
	});
	return { state, question };
}

export function questionScopeKey(
	examId: string,
	mode: PlayerMode,
	questionId?: QuestionId,
): string {
	return `${examId}/${mode === "question" ? `question/${questionId ?? ""}` : "exam"}`;
}

export function isModeEntryTarget(
	mode: PlayerMode,
	currentQuestionId: QuestionId,
	requestedQuestionId: QuestionId | undefined,
	currentIndex: number,
): boolean {
	return mode === "question" ? currentQuestionId === requestedQuestionId : currentIndex === 0;
}

export function countJudgments(state: ChallengeState): number {
	return Object.keys(state.judgments).length;
}

export function filterChallengeHistory(
	history: readonly CompletedChallengePayload[],
	examId: string,
	mode: PlayerMode,
	requestedQuestionId?: QuestionId,
): CompletedChallengePayload[] {
	return history.filter((item) => {
		if (item.examId !== examId) {
			return false;
		}
		if (mode === "exam") {
			return item.answers.length > 1;
		}
		return item.answers.length === 1 && item.answers[0]?.questionId === requestedQuestionId;
	});
}

export function getNavigationPosition(
	mode: PlayerMode,
	currentQuestionId: QuestionId,
	state: ChallengeState,
	questions: readonly PlayerQuestion[],
	getQuestionIndex: (questionId?: QuestionId) => number,
): Readonly<{ currentQuestionIndex: number; navigationLength: number }> {
	return {
		currentQuestionIndex:
			mode === "question" ? getQuestionIndex(currentQuestionId) : state.currentIndex,
		navigationLength: mode === "question" ? questions.length : state.questionIds.length,
	};
}
