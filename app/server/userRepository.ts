/**
 * users テーブルの upsert。
 *
 * timer / answer など複数機能が「ユーザー行の存在保証」に依存するため、
 * 特定 feature ではなく横断基盤（server/）に置く。
 */
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
