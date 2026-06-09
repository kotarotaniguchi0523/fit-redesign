import { type QuestionId, QuestionIdSchema, type UserId, UserIdSchema } from "../types";
import type { AnswerRecord, AnswerStatus } from "../types/answer";
import { upsertUser } from "./userRepository";

interface AnswerRow {
	id: number;
	user_id: string;
	question_id: string;
	selected_label: string;
	is_correct: number;
	duration: number | null;
	timestamp: number;
	created_at: number;
}

function rowToRecord(row: AnswerRow): AnswerRecord {
	return {
		id: row.id,
		userId: UserIdSchema.parse(row.user_id),
		questionId: QuestionIdSchema.parse(row.question_id),
		selectedLabel: row.selected_label,
		isCorrect: row.is_correct === 1,
		duration: row.duration,
		timestamp: row.timestamp,
		createdAt: row.created_at,
	};
}

export interface InsertAnswerInput {
	userId: UserId;
	questionId: QuestionId;
	selectedLabel: string;
	isCorrect: boolean;
	duration: number | null;
	timestamp: number;
}

export async function insertAnswer(db: D1Database, input: InsertAnswerInput): Promise<number> {
	const { userId, questionId, selectedLabel, isCorrect, duration, timestamp } = input;
	await upsertUser(db, userId);

	const result = await db
		.prepare(
			`INSERT INTO answers (user_id, question_id, selected_label, is_correct, duration, timestamp)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(userId, questionId, selectedLabel, isCorrect ? 1 : 0, duration, timestamp)
		.run();

	return result.meta.last_row_id;
}

export async function getLatestAnswers(
	db: D1Database,
	userId: UserId,
): Promise<Record<string, AnswerStatus>> {
	const result = await db
		.prepare(
			`SELECT question_id, selected_label, is_correct
			 FROM answers
			 WHERE user_id = ?
			   AND id = (
			     SELECT MAX(id) FROM answers a2
			     WHERE a2.user_id = answers.user_id AND a2.question_id = answers.question_id
			   )
			 ORDER BY question_id`,
		)
		.bind(userId)
		.all<{ question_id: string; selected_label: string; is_correct: number }>();

	return Object.fromEntries(
		result.results.map((row) => [
			row.question_id,
			{ label: row.selected_label, isCorrect: row.is_correct === 1 },
		]),
	);
}

/**
 * D1 から取得した行を questionId ごとの AnswerRecord[] にグルーピングする純粋関数。
 * クエリ結果と分離して getUserAnswerHistory とベンチ（dashboardAggregator.bench.ts）の
 * 双方が同一実装を呼ぶため export している。
 *
 * Map はこの関数内の accumulator としてだけ使い、返す値は新しい Record に変換する。
 * first-seen のキー挿入順を保持し、旧実装と同じ Record キー順・同値の出力になる。
 */
export function groupRowsByQuestion(rows: AnswerRow[]): Record<string, AnswerRecord[]> {
	// accumulator(private Map)の配列を in-place で push する。[...prev, record] で作り直すと
	// 問題あたり O(k²)（全体 O(m²)）になるため避ける。Map 挿入順 = first-seen キー順は維持される。
	const groupedRows = rows.reduce((history, row) => {
		const record = rowToRecord(row);
		const bucket = history.get(record.questionId);
		if (bucket) {
			bucket.push(record);
		} else {
			history.set(record.questionId, [record]);
		}
		return history;
	}, new Map<string, AnswerRecord[]>());

	return Object.fromEntries(groupedRows);
}

export async function getUserAnswerHistory(
	db: D1Database,
	userId: UserId,
): Promise<Record<string, AnswerRecord[]>> {
	const result = await db
		.prepare(
			`SELECT id, user_id, question_id, selected_label, is_correct, duration, timestamp, created_at
			 FROM answers
			 WHERE user_id = ?
			 ORDER BY timestamp ASC`,
		)
		.bind(userId)
		.all<AnswerRow>();

	return groupRowsByQuestion(result.results);
}

export type { AnswerRow };
