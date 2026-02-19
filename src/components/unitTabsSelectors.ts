import { getExamByNumber } from "../data/exams";
import type { ExamNumber, UnitBasedTab, UnitTabId, Year } from "../types";

export interface ExamSwitchItem {
	examNumber: ExamNumber;
	title: string;
}

export function selectUnitByKey(
	units: UnitBasedTab[],
	selectedKey: UnitTabId,
): UnitBasedTab | undefined {
	return units.find((unit) => unit.id === selectedKey);
}

// Cache for available years to avoid re-mapping on every render/interaction
const availableYearsCache = new WeakMap<UnitBasedTab, Year[]>();
// Cache for exam mappings by year to avoid O(N) lookup
const examMappingCache = new WeakMap<
	UnitBasedTab,
	Map<Year, UnitBasedTab["examMapping"][number]>
>();

export function selectAvailableYears(unit: UnitBasedTab | undefined): Year[] {
	if (!unit) {
		return [];
	}
	const cached = availableYearsCache.get(unit);
	if (cached) {
		return cached;
	}
	const years = unit.examMapping.map((mapping) => mapping.year);
	availableYearsCache.set(unit, years);
	return years;
}

export function selectExamMapping(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): UnitBasedTab["examMapping"][number] | undefined {
	if (!unit) {
		return undefined;
	}
	let cache = examMappingCache.get(unit);
	if (!cache) {
		cache = new Map();
		for (const mapping of unit.examMapping) {
			cache.set(mapping.year, mapping);
		}
		examMappingCache.set(unit, cache);
	}
	return cache.get(selectedYear);
}

export function selectExamNumbers(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): ExamNumber[] {
	const mapping = selectExamMapping(unit, selectedYear);
	return mapping?.examNumbers ?? [];
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
	const years = selectAvailableYears(unit);
	if (years.includes(selectedYear)) {
		return undefined;
	}
	return years[0];
}
