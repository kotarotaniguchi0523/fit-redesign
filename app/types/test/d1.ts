import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import type { Db } from "../../server/schema";

const CREATE_PROGRESS_SCHEMA = [
	"CREATE TABLE sync_links (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)",
	"CREATE TABLE question_progress (sync_link_id TEXT NOT NULL REFERENCES sync_links(id) ON DELETE CASCADE, question_id TEXT NOT NULL, unit_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (sync_link_id, question_id))",
	"CREATE INDEX idx_question_progress_recent ON question_progress(sync_link_id, updated_at)",
	"CREATE TABLE challenges (id TEXT PRIMARY KEY NOT NULL, sync_link_id TEXT NOT NULL REFERENCES sync_links(id) ON DELETE CASCADE, exam_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
	"CREATE INDEX idx_challenges_scope ON challenges(sync_link_id, exam_id, updated_at)",
	"CREATE TABLE answers (challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE, question_id TEXT NOT NULL, elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0), judgment TEXT NOT NULL CHECK (judgment IN ('correct', 'incorrect')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (challenge_id, question_id))",
] as const;

export type TestD1 = Readonly<{
	db: Db;
	binding: D1Database;
	dispose: () => Promise<void>;
}>;

export async function createTestD1(): Promise<TestD1> {
	const miniflare = new Miniflare({
		modules: true,
		script: "export default { fetch: () => new Response('ok') }",
		d1Databases: ["DB"],
	});
	const binding = await miniflare.getD1Database("DB");
	await binding.batch(CREATE_PROGRESS_SCHEMA.map((statement) => binding.prepare(statement)));
	return {
		db: drizzle(binding),
		binding,
		dispose: async (): Promise<void> => miniflare.dispose(),
	};
}
