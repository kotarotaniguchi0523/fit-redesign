import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { type Db, schema } from "../../server/schema";

const CREATE_PROGRESS_SCHEMA = [
	"CREATE TABLE sync_spaces (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)",
	"CREATE TABLE question_progress (sync_space_id TEXT NOT NULL REFERENCES sync_spaces(id) ON DELETE CASCADE, question_id TEXT NOT NULL, unit_id TEXT NOT NULL, revealed_at INTEGER NOT NULL, PRIMARY KEY (sync_space_id, question_id))",
	"CREATE INDEX idx_question_progress_recent ON question_progress(sync_space_id, revealed_at)",
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
		db: drizzle(binding, { schema }),
		binding,
		dispose: async (): Promise<void> => miniflare.dispose(),
	};
}
