import { execFileSync } from "node:child_process";
import { readdir, rename } from "node:fs/promises";
import { join } from "node:path";

const output = "migrations";
const before = new Set(await readdir(output));
execFileSync("pnpm", ["exec", "drizzle-kit", "generate", ...process.argv.slice(2)], { stdio: "inherit" });
const generated = (await readdir(output, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory() && !before.has(entry.name))
	.map((entry) => entry.name)
	.sort()
	.at(-1);

if (!generated) {
	console.log("No schema changes; no D1 migration was created.");
	process.exit(0);
}
const [timestamp, ...nameParts] = generated.split("_");
const name = nameParts.join("_") || "migration";
await rename(join(output, generated, "migration.sql"), join(output, `${timestamp}_${name}.sql`));
console.log(`Moved generated SQL into Wrangler D1 format: ${timestamp}_${name}.sql`);
