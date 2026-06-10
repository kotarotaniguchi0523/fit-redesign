import type { UserId } from "../types";
import { type Db, users } from "./schema";

/**
 * users テーブルの upsert（Drizzle）。
 *
 * answer など複数機能が「ユーザー行の存在保証」（FK 整合性）に依存するため、
 * 特定 feature ではなく横断基盤（server/）に置く。
 * 発行済み identity の登録簿なので `id` + `created_at` のみ保持する。
 */
export async function upsertUser(db: Db, userId: UserId): Promise<void> {
	await db
		.insert(users)
		.values({ id: userId, createdAt: Date.now() })
		.onConflictDoNothing({ target: users.id });
}
