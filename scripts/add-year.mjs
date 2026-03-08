#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// --- Argument validation ---

const year = process.argv[2];

if (!year) {
	console.error("Usage: node scripts/add-year.mjs <year>");
	console.error("Example: node scripts/add-year.mjs 2018");
	process.exit(1);
}

if (!/^\d{4}$/.test(year)) {
	console.error(`Error: "${year}" is not a valid 4-digit year.`);
	process.exit(1);
}

// --- Read YEARS from src/types/index.ts ---

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

if (existingYears.includes(year)) {
	console.error(`Error: Year "${year}" already exists in YEARS array.`);
	console.error(`Current years: ${existingYears.join(", ")}`);
	process.exit(1);
}

// --- Step 1: Add year to YEARS array in src/types/index.ts ---

const newYears = [...existingYears, year];
const newYearsStr = newYears.map((y) => `"${y}"`).join(", ");
const updatedTypesContent = typesContent.replace(
	/export const YEARS = \[[^\]]*\] as const;/,
	`export const YEARS = [${newYearsStr}] as const;`,
);

writeFileSync(typesPath, updatedTypesContent, "utf8");
console.log(`[OK] Added "${year}" to YEARS array in src/types/index.ts`);

// --- Step 2: Create 9 skeleton exam JSON files ---

const examsDir = path.join(repoRoot, "src/content/exams");
if (!existsSync(examsDir)) {
	mkdirSync(examsDir, { recursive: true });
}

for (let n = 1; n <= 9; n++) {
	const examId = `exam${n}-${year}`;
	const examData = {
		id: examId,
		number: n,
		title: `小テスト${n} (${year})`,
		pdfPath: `/pdf/Exam${n}-${year}.pdf`,
		answerPdfPath: `/pdf/Exam${year}-Ans.html`,
		questions: [],
	};

	const examPath = path.join(examsDir, `${examId}.json`);
	if (existsSync(examPath)) {
		console.log(`[SKIP] ${examId}.json already exists`);
		continue;
	}
	writeFileSync(examPath, `${JSON.stringify(examData, null, "\t")}\n`, "utf8");
	console.log(`[OK] Created ${examId}.json`);
}

// --- Step 3: Create mapping template ---

const mappingsDir = path.join(repoRoot, "scripts/year-mappings");
if (!existsSync(mappingsDir)) {
	mkdirSync(mappingsDir, { recursive: true });
}

const mappingPath = path.join(mappingsDir, `${year}.json`);

// Parse units from src/data/units.ts to extract unit IDs and latest year's examMapping
const unitsPath = path.join(repoRoot, "src/data/units.ts");
const unitsContent = readFileSync(unitsPath, "utf8");

/**
 * Extract unit-based tabs data from units.ts using bracket-matching.
 * Returns an array of { unitId, examNumbers } for each unit.
 */
function extractUnitMappings(content, latestYear) {
	const mappings = [];

	// Find all unit IDs in the unitBasedTabsData array
	const unitIdRegex = /id:\s*"(unit-[^"]+)"/g;
	let idMatch;
	const unitPositions = [];

	while ((idMatch = unitIdRegex.exec(content)) !== null) {
		unitPositions.push({ unitId: idMatch[1], pos: idMatch.index });
	}

	for (const { unitId, pos } of unitPositions) {
		// From this unit's position, find "examMapping: ["
		const examMappingMarker = "examMapping: [";
		const examMappingStart = content.indexOf(examMappingMarker, pos);
		if (examMappingStart === -1) continue;

		// Make sure this examMapping belongs to this unit, not the next one
		// (check there's no other unit ID between pos and examMappingStart)
		const nextUnit = unitPositions.find((u) => u.pos > pos);
		if (nextUnit && examMappingStart > nextUnit.pos) continue;

		// Find the opening bracket of examMapping array
		const arrayStart =
			examMappingStart + examMappingMarker.length - 1; // position of '['

		// Bracket-match to find the closing ']'
		let depth = 0;
		let arrayEnd = -1;
		for (let i = arrayStart; i < content.length; i++) {
			if (content[i] === "[") depth++;
			else if (content[i] === "]") {
				depth--;
				if (depth === 0) {
					arrayEnd = i;
					break;
				}
			}
		}
		if (arrayEnd === -1) continue;

		const examMappingBlock = content.substring(arrayStart + 1, arrayEnd);

		// Find the latest year's mapping for this unit
		const yearEntryRegex = new RegExp(
			`\\{\\s*year:\\s*"${latestYear}"\\s*,\\s*examNumbers:\\s*\\[([^\\]]+)\\]`,
		);
		const yearMatch = examMappingBlock.match(yearEntryRegex);

		if (yearMatch) {
			const examNumbers = yearMatch[1]
				.split(",")
				.map((s) => Number.parseInt(s.trim(), 10))
				.filter((n) => !Number.isNaN(n));
			mappings.push({ unitId, examNumbers });
		} else {
			// Unit doesn't have the latest year - find the most recent year it has
			const allYearEntries =
				examMappingBlock.match(/year:\s*"(\d{4})"/g) || [];
			const unitYears = allYearEntries
				.map((e) => e.match(/"(\d{4})"/)?.[1])
				.filter(Boolean)
				.sort();
			const mostRecentYear = unitYears[unitYears.length - 1];

			if (mostRecentYear) {
				const recentRegex = new RegExp(
					`\\{\\s*year:\\s*"${mostRecentYear}"\\s*,\\s*examNumbers:\\s*\\[([^\\]]+)\\]`,
				);
				const recentMatch = examMappingBlock.match(recentRegex);
				if (recentMatch) {
					const examNumbers = recentMatch[1]
						.split(",")
						.map((s) => Number.parseInt(s.trim(), 10))
						.filter((n) => !Number.isNaN(n));
					mappings.push({ unitId, examNumbers });
				}
			}
		}
	}

	return mappings;
}

// Determine the most recent existing year (before the new one)
const sortedExisting = [...existingYears].sort();
const latestExistingYear = sortedExisting[sortedExisting.length - 1];

const unitMappings = extractUnitMappings(unitsContent, latestExistingYear);

const mappingData = {
	year,
	mappings: unitMappings.map(({ unitId, examNumbers }) => ({
		unitId,
		examNumbers,
	})),
};

if (existsSync(mappingPath)) {
	console.log(`[SKIP] Mapping file ${year}.json already exists`);
} else {
	writeFileSync(
		mappingPath,
		`${JSON.stringify(mappingData, null, "\t")}\n`,
		"utf8",
	);
	console.log(
		`[OK] Created mapping template at scripts/year-mappings/${year}.json`,
	);
}

// --- Summary ---

console.log("\n========================================");
console.log(`Year ${year} scaffolding complete!`);
console.log("========================================");
console.log("\nNext steps:");
console.log(`  1. Edit scripts/year-mappings/${year}.json`);
console.log(
	"     - Adjust examNumbers for each unit based on the actual exam content",
);
console.log("     - Add integratedTitle where exams cover multiple units");
console.log("     - Remove units that don't have exams for this year");
console.log(`  2. Run: pnpm apply-year-mapping ${year}`);
console.log("  3. Add question data to src/content/exams/exam*-" + year + ".json");
console.log("  4. Place PDF files in public/pdf/");
console.log(`  5. Run: pnpm build to verify everything works`);
