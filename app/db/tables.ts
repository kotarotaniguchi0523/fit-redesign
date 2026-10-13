import { column as c, table } from "remix/data-table";

/**
 * `migrations/0001_initial.sql` の D1 スキーマに対応する data-table 定義。
 * スキーマを変更したら、この定義・マイグレーション・テスト用 D1 を揃える。
 */

export const syncLinks = table({
	name: "sync_links",
	primaryKey: "id",
	columns: {
		id: c.text().notNull(),
		created_at: c.integer().notNull(),
	},
});

export const questionProgress = table({
	name: "question_progress",
	primaryKey: ["sync_link_id", "question_id"],
	columns: {
		sync_link_id: c.text().notNull(),
		question_id: c.text().notNull(),
		unit_id: c.text().notNull(),
		created_at: c.integer().notNull(),
		updated_at: c.integer().notNull(),
	},
});

export const challenges = table({
	name: "challenges",
	primaryKey: "id",
	columns: {
		id: c.text().notNull(),
		sync_link_id: c.text().notNull(),
		exam_id: c.text().notNull(),
		created_at: c.integer().notNull(),
		updated_at: c.integer().notNull(),
	},
});

export const answers = table({
	name: "answers",
	primaryKey: ["challenge_id", "question_id"],
	columns: {
		challenge_id: c.text().notNull(),
		question_id: c.text().notNull(),
		elapsed_ms: c.integer().notNull(),
		judgment: c.enum(["correct", "incorrect"]).notNull(),
		created_at: c.integer().notNull(),
		updated_at: c.integer().notNull(),
	},
});
