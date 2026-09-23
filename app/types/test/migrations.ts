// biome-ignore-all lint/correctness/noNodejsModules: Test-only utility loads migration files in Node.
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const migrationsDirectory = resolve(process.cwd(), "migrations");

export async function applyMigrations(
	execute: (sql: string) => unknown | Promise<unknown>,
): Promise<void> {
	const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();

	for (const file of files) {
		const migration = await readFile(join(migrationsDirectory, file), "utf8");
		for (const statement of migration.split(";")) {
			if (statement.replace(/^\s*--.*$/gm, "").trim()) {
				await execute(statement);
			}
		}
	}
}
