#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const buildDir = "/tmp/exam-build";
const outDir = path.join(repoRoot, "src/data/exams-json");

await rm(buildDir, { recursive: true, force: true });
execSync(
	`pnpm exec tsgo --ignoreConfig src/data/exams/index.ts --outDir ${buildDir} --module commonjs --target es2022 --moduleResolution node --esModuleInterop`,
	{ cwd: repoRoot, stdio: "inherit" },
);

await symlink(path.join(repoRoot, "node_modules"), path.join(buildDir, "node_modules"), "dir");

const requireFromBuild = createRequire(path.join(buildDir, "data/exams/index.js"));
const { allExams } = requireFromBuild(path.join(buildDir, "data/exams/index.js"));

if (!Array.isArray(allExams)) {
	throw new Error("Failed to load allExams from compiled module");
}

await mkdir(outDir, { recursive: true });

const meta = {
	version: 1,
	exams: [],
};

for (const examByYear of allExams) {
	const years = Object.keys(examByYear.exams).sort();
	meta.exams.push({
		examNumber: examByYear.examNumber,
		title: examByYear.title,
		availableYears: years,
	});

	for (const year of years) {
		const exam = examByYear.exams[year];
		if (!exam) continue;
		const filename = `exam${examByYear.examNumber}-${year}.json`;
		await writeFile(path.join(outDir, filename), `${JSON.stringify(exam, null, "\t")}\n`, "utf8");
	}
}

meta.exams.sort((a, b) => a.examNumber - b.examNumber);
await writeFile(path.join(outDir, "exams-meta.json"), `${JSON.stringify(meta, null, "\t")}\n`, "utf8");

console.log(`Wrote ${meta.exams.length} exam groups to ${outDir}`);
