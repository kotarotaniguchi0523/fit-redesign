/**
 * D1 マイグレーションの健全性チェック。
 *
 * `drizzle-kit check` の置き換え。CF CLI（`cf d1 migrations apply`）が適用する
 * 素の SQL ファイルを対象に、最低限の整合性を検証する:
 * - `migrations/*.sql` が 1 つ以上存在する
 * - 空ファイルが無い
 * - 少なくとも 1 つの SQL 文（`;` で終わる）を含む
 *
 * 使い方: node scripts/check-migrations.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "migrations";

const files = readdirSync(DIR)
	.filter((name) => name.endsWith(".sql"))
	.sort();

if (files.length === 0) {
	console.error(`No migration files found in ${DIR}/`);
	process.exit(1);
}

const problems = [];
for (const name of files) {
	const content = readFileSync(join(DIR, name), "utf8");
	if (content.trim().length === 0) {
		problems.push(`${name}: empty file`);
		continue;
	}
	if (!/;\s*(\n|$)/.test(content)) {
		problems.push(`${name}: no statement terminator (;)`);
	}
}

if (problems.length > 0) {
	console.error("Migration problems:");
	for (const problem of problems) {
		console.error(`- ${problem}`);
	}
	process.exit(1);
}

console.log(`Checked ${files.length} migration file(s): ok`);
