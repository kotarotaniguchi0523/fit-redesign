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

const unitYearsCache = new WeakMap<UnitBasedTab, Year[]>();

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

type UnitExamMapping = UnitBasedTab["examMapping"][number];
const unitExamMappingCache = new WeakMap<UnitBasedTab, Map<Year, UnitExamMapping>>();

function getUnitExamMappingCache(unit: UnitBasedTab): Map<Year, UnitExamMapping> {
	let mapping = unitExamMappingCache.get(unit);
	if (!mapping) {
		mapping = new Map();
		for (const m of unit.examMapping) {
			mapping.set(m.year, m);
		}
		unitExamMappingCache.set(unit, mapping);
	}
	return mapping;
}

export function selectExamMapping(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): UnitExamMapping | undefined {
	if (!unit) return undefined;
	return getUnitExamMappingCache(unit).get(selectedYear);
}

export function selectExamNumbers(
	unit: UnitBasedTab | undefined,
	selectedYear: Year,
): ExamNumber[] {
	return selectExamMapping(unit, selectedYear)?.examNumbers ?? [];
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
