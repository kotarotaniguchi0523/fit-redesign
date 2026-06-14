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
	// ラップ式ストップウォッチのセットID（exam 単位の通しタイム集計用）。
	// 既存行・set_id 未付与の回答は null。answers.set_id を getUserAnswerHistory で read 済み。
	setId: string | null;
}

export interface AnswerStatus {
	label: string;
	isCorrect: boolean;
}
