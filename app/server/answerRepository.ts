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
		userId: row.user_id,
		questionId: row.question_id,
		selectedLabel: row.selected_label,
		isCorrect: row.is_correct === 1,
		duration: row.duration,
		timestamp: row.timestamp,
		createdAt: row.created_at,
	};
}

export interface InsertAnswerInput {
	userId: string;
	questionId: string;
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
	userId: string,
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
 * 1 パスで plain object に push して構築する（旧 reduce の
 * `history[qid] = [...(history[qid] ?? []), record]` は行ごとに配列を作り直し O(m^2) だった）。
 * 既存配列に破壊的 push するため push の不変版に戻すと O(m^2) になり、for...of を使う。
 * first-seen のキー挿入順を保持し、旧 reduce と同じ Record キー順・同値の出力になる。
 */
export function groupRowsByQuestion(rows: AnswerRow[]): Record<string, AnswerRecord[]> {
	const history: Record<string, AnswerRecord[]> = {};
	// 1 パスで plain object に直接 push（O(m) 構築）。
	for (const row of rows) {
		const record = rowToRecord(row);
		const bucket = history[record.questionId];
		if (bucket) {
			bucket.push(record);
		} else {
			history[record.questionId] = [record];
		}
	}
	return history;
}

export async function getUserAnswerHistory(
	db: D1Database,
	userId: string,
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
