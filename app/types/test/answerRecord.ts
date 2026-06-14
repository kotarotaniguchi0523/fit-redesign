import type { AnswerRecord } from "../answer";

/**
 * テスト用 AnswerRecord ファクトリ（共有フィクスチャ）。
 * 必要なフィールドだけ上書きし、未指定はもっともらしい既定で埋める。
 * createdAt 未指定時は呼び出し順で単調増加させ「時系列昇順」を表す。
 * branded 型（UserId/QuestionId）を緩く扱うため typecheck 除外の app/types/test 配下に置く。
 */
let sequence = 0;

export function makeAnswerRecord(
	partial: Partial<AnswerRecord> & { questionId: string },
): AnswerRecord {
	sequence += 1;
	return {
		id: sequence,
		userId: "u1",
		selectedLabel: "ア",
		isCorrect: true,
		duration: null,
		createdAt: 1_700_000_000_000 + sequence * 1000,
		setId: null,
		...partial,
	};
}

/** AnswerRecord 群を questionId ごとにまとめた answerHistory（aggregateStats 入力形）を作る。 */
export function makeAnswerHistory(records: AnswerRecord[]): Record<string, AnswerRecord[]> {
	return records.reduce<Record<string, AnswerRecord[]>>((history, record) => {
		const bucket = history[record.questionId] ?? [];
		bucket.push(record);
		history[record.questionId] = bucket;
		return history;
	}, {});
}
