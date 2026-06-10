import type { QuestionId, UserId } from "./domain";

export interface AnswerRecord {
	id: number;
	userId: UserId;
	questionId: QuestionId;
	selectedLabel: string;
	isCorrect: boolean;
	duration: number | null;
	// server Date.now()(ms)。時系列の基準（月次集計・順序）。
	createdAt: number;
}

export interface AnswerStatus {
	label: string;
	isCorrect: boolean;
}
