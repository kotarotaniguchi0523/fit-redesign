import { getExamByNumber } from "../data/exams";
import type { ExamNumber, UnitBasedTab, UnitTabId, Year } from "../types";

export interface ExamSwitchItem {
	examNumber: ExamNumber;
	title: string;
}

const unitYearsCache = new WeakMap<UnitBasedTab, Year[]>();

function getYearsForUnit(unit: UnitBasedTab): Year[] {
	const cached = unitYearsCache.get(unit);
	if (cached) {
		return cached;
	}
	const years = unit.examMapping.map((mapping) => mapping.year);
	unitYearsCache.set(unit, years);
	return years;
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
	return getYearsForUnit(unit);
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
	const years = getYearsForUnit(unit);
	if (years.includes(selectedYear)) {
		return undefined;
	}
	return years[0];
}
