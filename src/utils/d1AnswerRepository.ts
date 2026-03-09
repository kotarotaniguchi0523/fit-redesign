import type { AnswerRecord, AnswerStatus } from "../types/answer";
import { upsertUser } from "./d1TimerRepository";

interface D1Database {
	prepare(query: string): D1PreparedStatement;
	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	all<T = unknown>(): Promise<D1Result<T>>;
	run(): Promise<D1Result>;
	first<T = unknown>(): Promise<T | null>;
}

interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta: { last_row_id: number };
}

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

export async function insertAnswer(
	db: D1Database,
	userId: string,
	questionId: string,
	selectedLabel: string,
	isCorrect: boolean,
	duration: number | null,
	timestamp: number,
): Promise<number> {
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

	const statuses: Record<string, AnswerStatus> = {};
	for (const row of result.results) {
		statuses[row.question_id] = {
			label: row.selected_label,
			isCorrect: row.is_correct === 1,
		};
	}
	return statuses;
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

	const history: Record<string, AnswerRecord[]> = {};
	for (const row of result.results) {
		const record = rowToRecord(row);
		if (!history[record.questionId]) {
			history[record.questionId] = [];
		}
		history[record.questionId].push(record);
	}
	return history;
}
