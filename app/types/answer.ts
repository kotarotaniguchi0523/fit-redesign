import type { QuestionId, UserId } from "./domain";

export interface AnswerRecord {
	id: number;
	userId: UserId;
	questionId: QuestionId;
	selectedLabel: string;
	isCorrect: boolean;
	duration: number | null;
	timestamp: number;
	createdAt: number;
}

export interface AnswerStatus {
	label: string;
	isCorrect: boolean;
}
