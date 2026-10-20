import type { Judgment } from "../../types";
import type { ChallengeId, ExamId, QuestionId } from "../../types/browser";

export type { ChallengeId } from "../../types/browser";

export type ChallengeMode = "exam" | "question";
type ChallengeStateData = Readonly<{
	version: 1;
	challengeId: ChallengeId;
	scopeKey: string;
	examId: ExamId;
	mode: ChallengeMode;
	questionIds: readonly QuestionId[];
	createdAt: number;
	currentIndex: number;
	revealedQuestionIds: ReadonlySet<QuestionId>;
	judgments: Readonly<Partial<Record<QuestionId, Judgment>>>;
	answerCreatedAt: Readonly<Partial<Record<QuestionId, number>>>;
	questionElapsedMs: Readonly<Partial<Record<QuestionId, number>>>;
}>;

export type ChallengeState =
	| (ChallengeStateData & Readonly<{ status: "active" | "incomplete"; updatedAt: null }>)
	| (ChallengeStateData & Readonly<{ status: "completed"; updatedAt: number }>);

type ChallengeSnapshotData = Readonly<{
	version: 1;
	challengeId: ChallengeId;
	scopeKey: string;
	examId: ExamId;
	mode: ChallengeMode;
	questionIds: readonly QuestionId[];
	createdAt: number;
	currentIndex: number;
	revealedQuestionIds: readonly QuestionId[];
	judgments: Readonly<Partial<Record<QuestionId, Judgment>>>;
	answerCreatedAt: Readonly<Partial<Record<QuestionId, number>>>;
	questionElapsedMs: Readonly<Partial<Record<QuestionId, number>>>;
}>;

export type ChallengeSnapshot =
	| (ChallengeSnapshotData & Readonly<{ status: "active" | "incomplete"; updatedAt: null }>)
	| (ChallengeSnapshotData & Readonly<{ status: "completed"; updatedAt: number }>);

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
