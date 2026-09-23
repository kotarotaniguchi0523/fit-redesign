import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cwd = process.cwd();
const databaseDirectory = resolve(cwd, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const generated = await mkdtemp(join(tmpdir(), "fit-drizzle-pull-"));

if ((await readdir(join(cwd, "migrations"))).some((entry) => entry.endsWith("_baseline"))) {
	throw new Error("A Drizzle baseline already exists; do not replace migration history.");
}

try {
	execFileSync("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "fit-timer-db", "--local"], { cwd, stdio: "inherit" });
	const files = await readdir(databaseDirectory);
	const database = files.find((file) => file.endsWith(".sqlite"));
	if (!database) throw new Error("Local D1 database file not found; run db:migrate:local first.");
	execFileSync("pnpm", ["exec", "drizzle-kit", "pull", "--dialect", "sqlite", "--url", join(databaseDirectory, database), "--out", generated], { cwd, stdio: "inherit" });
	const migrationDirectory = (await readdir(generated, { withFileTypes: true })).find((entry) => entry.isDirectory());
	if (!migrationDirectory) throw new Error("Drizzle introspection did not create a schema snapshot.");
	const snapshot = await readFile(join(generated, migrationDirectory.name, "snapshot.json"));
	const baselineDirectory = join(cwd, "migrations", `${migrationDirectory.name}_baseline`);
	await cp(join(generated, migrationDirectory.name), baselineDirectory, { recursive: true });
	await writeFile(join(baselineDirectory, "snapshot.json"), snapshot);
	await rm(join(baselineDirectory, "migration.sql"));
	console.log(`Captured the local D1 baseline in ${baselineDirectory}`);
} finally {
	await rm(generated, { recursive: true, force: true });
}
