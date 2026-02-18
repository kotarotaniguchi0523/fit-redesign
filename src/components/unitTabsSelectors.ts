import { getExamByNumber } from "../data/exams";
import type { ExamNumber, UnitBasedTab, UnitTabId, Year } from "../types";

export interface ExamSwitchItem {
	examNumber: ExamNumber;
	title: string;
}

const unitYearsCache = new WeakMap<UnitBasedTab, Year[]>();
const unitExamNumbersCache = new WeakMap<UnitBasedTab, Map<Year, ExamNumber[]>>();

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
	let years = unitYearsCache.get(unit);
	if (!years) {
		years = unit.examMapping.map((mapping) => mapping.year);
		unitYearsCache.set(unit, years);
	}
	return years;
}

export function selectExamNumbers(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): ExamNumber[] {
	if (!unit) {
		return [];
	}

	let yearMap = unitExamNumbersCache.get(unit);
	if (!yearMap) {
		yearMap = new Map();
		for (const mapping of unit.examMapping) {
			yearMap.set(mapping.year, mapping.examNumbers);
		}
		unitExamNumbersCache.set(unit, yearMap);
	}

	return yearMap.get(selectedYear) ?? [];
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
