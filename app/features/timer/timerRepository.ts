import { MAX_ATTEMPTS_PER_QUESTION } from "../../constants";
import { upsertUser } from "../../server/userRepository";
import type { QuestionId } from "../../types";
import type { AttemptRecord, TimerStorageData } from "./types";

/** D1 の batch 上限（1 バッチあたりの最大ステートメント数）。 */
const BATCH_LIMIT = 100;

interface AttemptRow {
	question_id: string;
	timestamp: number;
	duration: number;
	mode: string;
	target_time: number | null;
	completed: number;
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
		let record = records[qid];
		if (!record) {
			record = { questionId: qid, attempts: [] };
			records[qid] = record;
		}
		const attempt: AttemptRecord = {
			timestamp: row.timestamp,
			duration: row.duration,
			mode: row.mode as AttemptRecord["mode"],
			completed: row.completed === 1,
			...(row.target_time != null ? { targetTime: row.target_time } : {}),
		};
		record.attempts.push(attempt);
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

	// クライアントの attempts を D1 へ挿入。重複は (user_id, question_id, timestamp) の一意
	// インデックス（migration 0003）+ INSERT OR IGNORE で DB が弾く。旧 'WHERE NOT EXISTS' は
	// TOCTOU レースで二重挿入されえたが、OR IGNORE は同時 sync でも一意制約で確実に冪等。
	const now = Date.now();
	const statements = Object.values(clientRecords)
		.filter((record): record is ClientRecord => record != null)
		.flatMap((record) =>
			record.attempts.map((attempt) =>
				db
					.prepare(
						`INSERT OR IGNORE INTO attempts
						   (user_id, question_id, timestamp, duration, mode, target_time, completed, synced_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
					),
			),
		);

	// バッチ実行（D1 は最大100文ずつ）
	const chunks = Array.from({ length: Math.ceil(statements.length / BATCH_LIMIT) }, (_, i) =>
		statements.slice(i * BATCH_LIMIT, i * BATCH_LIMIT + BATCH_LIMIT),
	);
	await Promise.all(chunks.map((chunk) => db.batch(chunk)));

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
