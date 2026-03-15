import { MAX_ATTEMPTS_PER_QUESTION } from "../constants";
import type { QuestionId } from "../types";
import type { AttemptRecord, TimerStorageData } from "../types/timer";

interface D1Database {
	prepare(query: string): D1PreparedStatement;
	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	all<T = unknown>(): Promise<D1Result<T>>;
	run(): Promise<D1Result>;
}

interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
}

interface AttemptRow {
	question_id: string;
	timestamp: number;
	duration: number;
	mode: string;
	target_time: number | null;
	completed: number;
}

export async function upsertUser(db: D1Database, userId: string): Promise<void> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO users (id, created_at, last_seen_at) VALUES (?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET last_seen_at = ?`,
		)
		.bind(userId, now, now, now)
		.run();
}

export async function loadUserAttempts(db: D1Database, userId: string): Promise<TimerStorageData> {
	const result = await db
		.prepare(
			"SELECT question_id, timestamp, duration, mode, target_time, completed FROM attempts WHERE user_id = ? ORDER BY timestamp ASC",
		)
		.bind(userId)
		.all<AttemptRow>();

	const records: TimerStorageData["records"] = {};

	for (const row of result.results) {
		const qid = row.question_id as QuestionId;
		if (!records[qid]) {
			records[qid] = { questionId: qid, attempts: [] };
		}
		const attempt: AttemptRecord = {
			timestamp: row.timestamp,
			duration: row.duration,
			mode: row.mode as AttemptRecord["mode"],
			completed: row.completed === 1,
			...(row.target_time != null ? { targetTime: row.target_time } : {}),
		};
		records[qid]!.attempts.push(attempt);
	}

	// 各問題ごとに MAX_ATTEMPTS_PER_QUESTION で切り詰め
	for (const record of Object.values(records)) {
		if (record && record.attempts.length > MAX_ATTEMPTS_PER_QUESTION) {
			record.attempts = record.attempts.slice(-MAX_ATTEMPTS_PER_QUESTION);
		}
	}

	return { version: 1, records };
}

interface ClientRecord {
	questionId: string;
	attempts: {
		timestamp: number;
		duration: number;
		mode: string;
		completed: boolean;
		targetTime?: number;
	}[];
}

export async function syncAttempts(
	db: D1Database,
	userId: string,
	clientRecords: Record<string, ClientRecord>,
): Promise<TimerStorageData> {
	await upsertUser(db, userId);

	// クライアントの attempts を D1 に挿入（timestamp で重複チェック）
	const statements: D1PreparedStatement[] = [];
	const now = Date.now();

	for (const record of Object.values(clientRecords)) {
		if (!record) continue;
		for (const attempt of record.attempts) {
			statements.push(
				db
					.prepare(
						`INSERT INTO attempts (user_id, question_id, timestamp, duration, mode, target_time, completed, synced_at)
						 SELECT ?, ?, ?, ?, ?, ?, ?, ?
						 WHERE NOT EXISTS (
						   SELECT 1 FROM attempts WHERE user_id = ? AND question_id = ? AND timestamp = ?
						 )`,
					)
					.bind(
						userId,
						record.questionId,
						attempt.timestamp,
						attempt.duration,
						attempt.mode,
						attempt.targetTime ?? null,
						attempt.completed ? 1 : 0,
						now,
						userId,
						record.questionId,
						attempt.timestamp,
					),
			);
		}
	}

	// バッチ実行（D1 は最大100文ずつ）
	const batchPromises: Promise<D1Result<unknown>[]>[] = [];
	for (let i = 0; i < statements.length; i += 100) {
		batchPromises.push(db.batch(statements.slice(i, i + 100)));
	}
	await Promise.all(batchPromises);

	// マージ後の全データを返却
	return loadUserAttempts(db, userId);
}

export async function clearUserQuestionRecords(
	db: D1Database,
	userId: string,
	questionId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM attempts WHERE user_id = ? AND question_id = ?")
		.bind(userId, questionId)
		.run();
}
