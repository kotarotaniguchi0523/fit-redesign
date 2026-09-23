import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import type { Db } from "../../server/schema";
import { applyMigrations } from "./migrations";

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
	await applyMigrations((migration) => binding.prepare(migration).run());
	return {
		db: drizzle(binding),
		binding,
		dispose: async (): Promise<void> => miniflare.dispose(),
	};
}
