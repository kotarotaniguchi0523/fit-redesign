import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle スキーマ。query 型付けの唯一の源として手書きし、wrangler の baseline SQL と一致させる
// （生成器は使わず手動同期。ADR: docs/showboat/adr-d1-schema.md）。
// DB 列名は snake_case、TS フィールドは camelCase で対応させる。

// 発行済み匿名 identity の登録簿（id は cookie UUID）。
export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	createdAt: integer("created_at").notNull(),
});

// 問題マスタ（静的 JSON から seed）。answers の参照先で、未登録 json_id は記録不可の門番。
export const questions = sqliteTable("questions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	jsonId: text("json_id").notNull().unique(),
});

// 採点済み解答（1行 = 1回答。append-only の学習記録）。
export const answers = sqliteTable(
	"answers",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		questionId: integer("question_id")
			.notNull()
			.references(() => questions.id),
		selectedLabel: text("selected_label").notNull(),
		isCorrect: integer("is_correct").notNull(),
		duration: integer("duration"),
		// server Date.now()(ms)。月次集計・順序の基準。
		createdAt: integer("created_at").notNull(),
	},
	(t) => [
		check("answers_is_correct_check", sql`${t.isCorrect} in (0,1)`),
		check("answers_duration_check", sql`${t.duration} is null or ${t.duration} >= 0`),
		index("idx_answers_user_question").on(t.userId, t.questionId),
		index("idx_answers_user_created").on(t.userId, t.createdAt),
	],
);

// schema は drizzle(env.DB, { schema }) に渡すバレル。
export const schema = { users, questions, answers };

// 全 Hono context（createRoute 含む）で c.var.db に型を付けるための Db 型。
export type Db = DrizzleD1Database<typeof schema>;

export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferSelect;
export type QuestionInsert = typeof questions.$inferInsert;
export type QuestionSelect = typeof questions.$inferSelect;
export type AnswerInsert = typeof answers.$inferInsert;
export type AnswerSelect = typeof answers.$inferSelect;
