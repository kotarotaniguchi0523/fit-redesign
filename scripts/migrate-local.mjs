/**
 * D1 マイグレーションのローカル適用。
 *
 * `migrations/*.sql` を順に SQLite へ適用して検証する（Node 24 標準の `node:sqlite`）。
 * CI はネットワーク越しの初期化ができないため、ここで完結させる。
 * ローカル（`CI` 未設定）では、この検証に加えて `cf d1` で実体のローカル D1 へも
 * 適用する（開発時の `pnpm db:migrate:local` の挙動を保つ）。
 *
 * 使い方: node scripts/migrate-local.mjs
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DIR = "migrations";
const DATABASE_ID = "57532062-e9cf-4a86-a89f-fc6fdb1e3ba5";

const files = readdirSync(DIR)
	.filter((name) => name.endsWith(".sql"))
	.sort();

if (files.length === 0) {
	console.error(`No migration files found in ${DIR}/`);
	process.exit(1);
}

const database = new DatabaseSync(":memory:");
try {
	for (const name of files) {
		database.exec(readFileSync(join(DIR, name), "utf8"));
	}
	const tables = database
		.prepare("select name from sqlite_master where type = 'table' order by name")
		.all()
		.map((row) => row.name);
	if (tables.length === 0) {
		console.error("Migrations applied but created no tables");
		process.exit(1);
	}
	console.log(`Applied ${files.length} migration(s): ${tables.join(", ")}`);
} finally {
	database.close();
}

if (process.env.CI) {
	process.exit(0);
}

const result = spawnSync(
	"cf",
	["d1", "migrations", "apply", DATABASE_ID, "--local", "--persist-to", ".wrangler/state", "--dir", DIR],
	{ stdio: "inherit" },
);
process.exit(result.status ?? 1);
