import { getExamByNumber } from "../data/exams";
import type { ExamNumber, UnitBasedTab, UnitTabId, Year } from "../types";

export interface ExamSwitchItem {
	examNumber: ExamNumber;
	title: string;
}

// Extract the type of a single exam mapping entry from UnitBasedTab
export type UnitExamMapping = UnitBasedTab["examMapping"][number];

// Cache structure for memoization
interface UnitCache {
	availableYears: Year[];
	examMap: Map<Year, UnitExamMapping>;
}

// Global WeakMap cache to store derived data for each unit instance
const unitCache = new WeakMap<UnitBasedTab, UnitCache>();

/**
 * Retrieves or creates a cached object containing derived data for the unit.
 * Using WeakMap ensures we don't leak memory if unit objects are replaced.
 */
function getUnitCache(unit: UnitBasedTab): UnitCache {
	let cache = unitCache.get(unit);
	if (!cache) {
		const availableYears = unit.examMapping.map((mapping) => mapping.year);

		// Build a map for O(1) lookup of the entire mapping object by year
		// We only store the first occurrence for each year to match Array.find() behavior
		const examMap = new Map<Year, UnitExamMapping>();
		for (const mapping of unit.examMapping) {
			if (!examMap.has(mapping.year)) {
				examMap.set(mapping.year, mapping);
			}
		}

		cache = { availableYears, examMap };
		unitCache.set(unit, cache);
	}
	return cache;
}

export function selectUnitByKey(
	units: UnitBasedTab[],
	selectedKey: UnitTabId,
): UnitBasedTab | undefined {
	return units.find((unit) => unit.id === selectedKey);
}

export function selectAvailableYears(unit: UnitBasedTab | undefined): Year[] {
	if (!unit) {
		return [];
	}
	return getUnitCache(unit).availableYears;
}

/**
 * Retrieves the full exam mapping object for a given unit and year.
 * This is an O(1) operation using the cached map.
 */
export function selectExamMapping(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): UnitExamMapping | undefined {
	if (!unit) {
		return undefined;
	}
	return getUnitCache(unit).examMap.get(selectedYear);
}

export function selectExamNumbers(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): ExamNumber[] {
	if (!unit) {
		return [];
	}
	return getUnitCache(unit).examMap.get(selectedYear)?.examNumbers ?? [];
}

export function selectActiveExamNumber(
	examNumbers: ExamNumber[],
	selectedExamNumber: ExamNumber | null,
): ExamNumber | null {
	if (selectedExamNumber !== null && examNumbers.includes(selectedExamNumber)) {
		return selectedExamNumber;
	}
	return examNumbers[0] ?? null;
}

export function selectExamSwitchItems(
	examNumbers: ExamNumber[],
	selectedYear: Year,
): ExamSwitchItem[] {
	return examNumbers
		.map((examNumber) => {
			const examData = getExamByNumber(examNumber);
			if (!examData) {
				return undefined;
			}
			return {
				examNumber,
				title: examData.exams[selectedYear]?.title ?? examData.title,
			};
		})
		.filter((item): item is ExamSwitchItem => Boolean(item));
}

export function selectFallbackYear(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): Year | undefined {
	if (!unit) {
		return undefined;
	}
	// Use cached availableYears array
	const years = getUnitCache(unit).availableYears;
	if (years.includes(selectedYear)) {
		return undefined;
	}
	return years[0];
}
