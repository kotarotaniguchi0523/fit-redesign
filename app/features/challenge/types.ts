import type { Judgment, QuestionId } from "../../types";

export type ChallengeId = string;
export type ChallengeMode = "exam" | "question";
export type ChallengeStatus = "active" | "incomplete" | "completed";

export type ChallengeState = Readonly<{
	version: 1;
	challengeId: ChallengeId;
	scopeKey: string;
	examId: string;
	mode: ChallengeMode;
	questionIds: readonly QuestionId[];
	createdAt: number;
	updatedAt: number | null;
	currentIndex: number;
	revealedQuestionIds: ReadonlySet<QuestionId>;
	judgments: Readonly<Partial<Record<QuestionId, Judgment>>>;
	answerCreatedAt: Readonly<Partial<Record<QuestionId, number>>>;
	questionElapsedMs: Readonly<Partial<Record<QuestionId, number>>>;
	status: ChallengeStatus;
}>;

export type ChallengeSnapshot = Readonly<{
	version: 1;
	challengeId: ChallengeId;
	scopeKey: string;
	examId: string;
	mode: ChallengeMode;
	questionIds: readonly QuestionId[];
	createdAt: number;
	updatedAt: number | null;
	currentIndex: number;
	revealedQuestionIds: readonly QuestionId[];
	judgments: Readonly<Partial<Record<QuestionId, Judgment>>>;
	answerCreatedAt: Readonly<Partial<Record<QuestionId, number>>>;
	questionElapsedMs: Readonly<Partial<Record<QuestionId, number>>>;
	status: ChallengeStatus;
}>;

export type CompletedAnswer = Readonly<{
	questionId: QuestionId;
	elapsedMs: number;
	judgment: Judgment;
	createdAt: number;
	updatedAt: number;
}>;

export type CompletedChallengePayload = Readonly<{
	challengeId: ChallengeId;
	examId: string;
	createdAt: number;
	updatedAt: number;
	answers: readonly CompletedAnswer[];
}>;

export type ChallengeResultSummary = Readonly<{
	challengeCount: number;
	judgedCount: number;
	correctCount: number;
	incorrectCount: number;
	accuracy: number | null;
	totalElapsedMs: number;
}>;

export type QuestionResultSummary = Readonly<{
	questionId: QuestionId;
	challengeCount: number;
	correctCount: number;
	incorrectCount: number;
	judgedCount: number;
	totalElapsedMs: number;
	averageElapsedMs: number | null;
}>;
