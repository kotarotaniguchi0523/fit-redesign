#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// --- Argument validation ---

const year = process.argv[2];

if (!year) {
	console.error("Usage: node scripts/apply-year-mapping.mjs <year>");
	console.error("Example: node scripts/apply-year-mapping.mjs 2018");
	process.exit(1);
}

if (!/^\d{4}$/.test(year)) {
	console.error(`Error: "${year}" is not a valid 4-digit year.`);
	process.exit(1);
}

// --- Validate YEARS array contains this year ---

const typesPath = path.join(repoRoot, "src/types/index.ts");
const typesContent = readFileSync(typesPath, "utf8");

const yearsMatch = typesContent.match(
	/export const YEARS = \[([^\]]*)\] as const;/,
);
if (!yearsMatch) {
	console.error("Error: Could not find YEARS array in src/types/index.ts");
	process.exit(1);
}

const existingYears = yearsMatch[1]
	.split(",")
	.map((s) => s.trim().replace(/"/g, ""))
	.filter(Boolean);

if (!existingYears.includes(year)) {
	console.error(
		`Error: Year "${year}" is not in YEARS array. Run "pnpm add-year ${year}" first.`,
	);
	process.exit(1);
}

// --- Read mapping file ---

const mappingPath = path.join(repoRoot, "scripts/year-mappings", `${year}.json`);

if (!existsSync(mappingPath)) {
	console.error(`Error: Mapping file not found: ${mappingPath}`);
	console.error(`Run "pnpm add-year ${year}" first to generate the template.`);
	process.exit(1);
}

let mappingData;
try {
	mappingData = JSON.parse(readFileSync(mappingPath, "utf8"));
} catch (e) {
	console.error(`Error: Failed to parse ${mappingPath}: ${e.message}`);
	process.exit(1);
}

if (!mappingData.year || !Array.isArray(mappingData.mappings)) {
	console.error(
		'Error: Invalid mapping file format. Expected { year, mappings: [...] }',
	);
	process.exit(1);
}

if (mappingData.year !== year) {
	console.error(
		`Error: Mapping file year "${mappingData.year}" does not match argument "${year}".`,
	);
	process.exit(1);
}

// --- Read and modify units.ts ---

const unitsPath = path.join(repoRoot, "src/data/units.ts");
let unitsContent = readFileSync(unitsPath, "utf8");

// Check if this year already has entries in units.ts
const yearAlreadyExists = new RegExp(
	`year:\\s*"${year}"`,
).test(unitsContent);

if (yearAlreadyExists) {
	console.error(
		`Error: Year "${year}" already has entries in src/data/units.ts.`,
	);
	console.error("Remove existing entries first or use a different year.");
	process.exit(1);
}

let modifiedCount = 0;

for (const mapping of mappingData.mappings) {
	const { unitId, examNumbers, integratedTitle } = mapping;

	// Build the new entry string
	let newEntry = `\t\t\t{ year: "${year}", examNumbers: [${examNumbers.join(", ")}]`;
	if (integratedTitle) {
		newEntry += `, integratedTitle: "${integratedTitle}"`;
	}
	newEntry += " }";

	// Find the unit block and its examMapping array
	// Strategy: Find the unit by its id, then find the last entry in its examMapping array

	// Find the position of this unit's examMapping closing bracket
	// We need to find: id: "unit-xxx" ... examMapping: [ ... ],
	const unitIdPos = unitsContent.indexOf(`id: "${unitId}"`);
	if (unitIdPos === -1) {
		console.warn(`[WARN] Unit "${unitId}" not found in units.ts, skipping.`);
		continue;
	}

	// From the unit's position, find "examMapping: ["
	const examMappingStart = unitsContent.indexOf("examMapping: [", unitIdPos);
	if (examMappingStart === -1) {
		console.warn(
			`[WARN] examMapping not found for unit "${unitId}", skipping.`,
		);
		continue;
	}

	// Find the matching closing bracket for this examMapping array
	// We need to handle nested brackets carefully
	const arrayStart = unitsContent.indexOf("[", examMappingStart);
	let bracketDepth = 0;
	let arrayEnd = -1;

	for (let i = arrayStart; i < unitsContent.length; i++) {
		if (unitsContent[i] === "[") {
			bracketDepth++;
		} else if (unitsContent[i] === "]") {
			bracketDepth--;
			if (bracketDepth === 0) {
				arrayEnd = i;
				break;
			}
		}
	}

	if (arrayEnd === -1) {
		console.warn(
			`[WARN] Could not find end of examMapping array for unit "${unitId}", skipping.`,
		);
		continue;
	}

	// Find the last entry's closing brace before the array end
	// Look backwards from arrayEnd for the last '}'
	let lastEntryEnd = -1;
	for (let i = arrayEnd - 1; i >= arrayStart; i--) {
		if (unitsContent[i] === "}") {
			lastEntryEnd = i;
			break;
		}
	}

	if (lastEntryEnd === -1) {
		console.warn(
			`[WARN] Could not find last entry in examMapping for unit "${unitId}", skipping.`,
		);
		continue;
	}

	// Check if there's a trailing comma after the last entry
	const afterLastEntry = unitsContent.substring(lastEntryEnd + 1, arrayEnd);
	const hasTrailingComma = afterLastEntry.includes(",");

	// Insert the new entry after the last entry
	let insertion;
	if (hasTrailingComma) {
		// Already has trailing comma, just add new entry with trailing comma
		insertion = `\n${newEntry},`;
		// Find the comma position to insert after it
		const commaPos =
			lastEntryEnd + 1 + afterLastEntry.indexOf(",");
		unitsContent =
			unitsContent.substring(0, commaPos + 1) +
			insertion +
			unitsContent.substring(commaPos + 1);
	} else {
		// No trailing comma, add comma after last entry then new entry
		insertion = `,\n${newEntry},`;
		unitsContent =
			unitsContent.substring(0, lastEntryEnd + 1) +
			insertion +
			unitsContent.substring(lastEntryEnd + 1);
	}

	modifiedCount++;
	console.log(
		`[OK] Added ${year} mapping to "${unitId}" (examNumbers: [${examNumbers.join(", ")}])`,
	);
}

if (modifiedCount === 0) {
	console.error("Error: No units were modified. Check your mapping file.");
	process.exit(1);
}

writeFileSync(unitsPath, unitsContent, "utf8");
console.log(
	`\n[OK] Modified ${modifiedCount} units in src/data/units.ts`,
);

// --- Run data:convert ---

console.log("\nRunning pnpm data:convert ...");
try {
	execSync("pnpm data:convert", {
		cwd: repoRoot,
		stdio: "inherit",
	});
	console.log("[OK] data:convert completed successfully.");
} catch (e) {
	console.error(
		"[WARN] data:convert failed. You may need to run it manually after fixing issues.",
	);
	console.error(`  Error: ${e.message}`);
}

// --- Summary ---

console.log("\n========================================");
console.log(`Year ${year} mapping applied!`);
console.log("========================================");
console.log(`\nModified ${modifiedCount} unit(s) in src/data/units.ts`);
console.log("\nNext steps:");
console.log(
	`  1. Add question data to src/content/exams/exam*-${year}.json`,
);
console.log("  2. Place PDF files in public/pdf/");
console.log("  3. Run: pnpm build to verify everything works");
