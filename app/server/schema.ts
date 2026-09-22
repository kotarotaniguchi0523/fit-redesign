import type { DrizzleD1Database } from "drizzle-orm/d1";
import { customType, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle スキーマ。query 型付けの唯一の源として手書きし、wrangler の migration SQL と一致させる。
// DB 列名は snake_case、TypeScript フィールドは camelCase で対応させる。

const syncLinkIdText = customType<{ data: string; driverData: string }>({
	dataType: () => "text",
});
const questionIdText = customType<{ data: string; driverData: string }>({
	dataType: () => "text",
});
const unitTabIdText = customType<{ data: string; driverData: string }>({
	dataType: () => "text",
});
const examIdText = customType<{ data: string; driverData: string }>({
	dataType: () => "text",
});
const epochMillisecondsInteger = customType<{ data: number; driverData: number }>({
	dataType: () => "integer",
});
const judgmentText = customType<{ data: string; driverData: string }>({
	dataType: () => "text",
});

// 秘密リンクの生値は保存せず、SHA-256 ハッシュだけを主キーとして保持する。
export const syncLinks = sqliteTable("sync_links", {
	id: syncLinkIdText("id").primaryKey(),
	createdAt: epochMillisecondsInteger("created_at").notNull(),
});

// 1問題につき、初回確認時刻と最新確認時刻を保持する。
export const questionProgress = sqliteTable(
	"question_progress",
	{
		syncLinkId: syncLinkIdText("sync_link_id")
			.notNull()
			.references(() => syncLinks.id, { onDelete: "cascade" }),
		questionId: questionIdText("question_id").notNull(),
		unitId: unitTabIdText("unit_id").notNull(),
		createdAt: epochMillisecondsInteger("created_at").notNull(),
		updatedAt: epochMillisecondsInteger("updated_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.syncLinkId, t.questionId] }),
		index("idx_question_progress_recent").on(t.syncLinkId, t.updatedAt),
	],
);

// 1回の小テストまたは単問計測。完了状態は answers の揃い方から導出する。
export const challenges = sqliteTable(
	"challenges",
	{
		id: text("id").primaryKey(),
		syncLinkId: syncLinkIdText("sync_link_id")
			.notNull()
			.references(() => syncLinks.id, { onDelete: "cascade" }),
		examId: examIdText("exam_id").notNull(),
		createdAt: epochMillisecondsInteger("created_at").notNull(),
		updatedAt: epochMillisecondsInteger("updated_at").notNull(),
	},
	(t) => [index("idx_challenges_scope").on(t.syncLinkId, t.examId, t.updatedAt)],
);

// 1試行の問題ごとの自己判定と累積可視時間。完了時の値だけを D1 に保存する。
export const answers = sqliteTable(
	"answers",
	{
		challengeId: text("challenge_id")
			.notNull()
			.references(() => challenges.id, { onDelete: "cascade" }),
		questionId: questionIdText("question_id").notNull(),
		elapsedMs: integer("elapsed_ms").notNull(),
		judgment: judgmentText("judgment").notNull(),
		createdAt: epochMillisecondsInteger("created_at").notNull(),
		updatedAt: epochMillisecondsInteger("updated_at").notNull(),
	},
	(t) => [primaryKey({ columns: [t.challengeId, t.questionId] })],
);

// 全 Hono context（createRoute 含む）で c.var.db に型を付けるための Db 型。
export type Db = DrizzleD1Database;
