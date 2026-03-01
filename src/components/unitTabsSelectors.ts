import { getExamByNumber } from "../data/exams";
import type { ExamNumber, UnitBasedTab, UnitTabId, Year } from "../types";

export interface ExamSwitchItem {
	examNumber: ExamNumber;
	title: string;
}

// Caches for derived state to avoid O(N) operations on every interaction.
const availableYearsCache = new WeakMap<UnitBasedTab, Year[]>();
const availableYearsSetCache = new WeakMap<UnitBasedTab, Set<Year>>();

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

	const cached = availableYearsCache.get(unit);
	if (cached) {
		return cached;
	}

	const years = unit.examMapping.map((mapping) => mapping.year);
	availableYearsCache.set(unit, years);
	availableYearsSetCache.set(unit, new Set(years));
	return years;
}

export function selectExamNumbers(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): ExamNumber[] {
	return unit?.examMapping.find((mapping) => mapping.year === selectedYear)?.examNumbers ?? [];
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
	const yearsSet = availableYearsSetCache.get(unit);

	if (yearsSet?.has(selectedYear)) {
		return undefined;
	}
	return years[0];
}
