import type { DrizzleD1Database } from "drizzle-orm/d1";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle スキーマ。query 型付けの唯一の源として手書きし、wrangler の baseline SQL と一致させる
// （生成器は使わず手動同期。ADR: docs/showboat/adr-d1-schema.md）。
// DB 列名は snake_case、TS フィールドは camelCase で対応させる。

// 秘密リンクの生値は保存せず、SHA-256 ハッシュだけを主キーとして保持する。
export const syncSpaces = sqliteTable("sync_spaces", {
	id: text("id").primaryKey(),
	createdAt: integer("created_at").notNull(),
});

// 1問題につき最新の「答えを確認した時刻」だけを保持する。
export const questionProgress = sqliteTable(
	"question_progress",
	{
		syncSpaceId: text("sync_space_id")
			.notNull()
			.references(() => syncSpaces.id, { onDelete: "cascade" }),
		questionId: text("question_id").notNull(),
		unitId: text("unit_id").notNull(),
		revealedAt: integer("revealed_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.syncSpaceId, t.questionId] }),
		index("idx_question_progress_recent").on(t.syncSpaceId, t.revealedAt),
	],
);

// schema は drizzle(env.DB, { schema }) に渡すバレル。
export const schema = { syncSpaces, questionProgress };

// 全 Hono context（createRoute 含む）で c.var.db に型を付けるための Db 型。
export type Db = DrizzleD1Database<typeof schema>;
