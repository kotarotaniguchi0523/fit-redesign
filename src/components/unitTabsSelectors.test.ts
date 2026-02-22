import { describe, expect, it } from "vitest";
import { unitBasedTabs } from "../data/units";
import type { Year } from "../types";
import {
	selectActiveExamNumber,
	selectAvailableYears,
	selectExamNumbers,
	selectExamSwitchItems,
	selectFallbackYear,
	selectUnitByKey,
} from "./unitTabsSelectors";

describe("unitTabsSelectors", () => {
	it("selectUnitByKey returns the requested unit", () => {
		const selected = selectUnitByKey(unitBasedTabs, "unit-ecc");
		expect(selected?.name).toBe("符号理論");
	});

	it("selectAvailableYears returns mapped years", () => {
		const unit = selectUnitByKey(unitBasedTabs, "unit-sort");
		expect(selectAvailableYears(unit)).toEqual(["2013", "2014"]);
	});

	it("selectAvailableYears returns referentially stable array for the same unit", () => {
		const unit = selectUnitByKey(unitBasedTabs, "unit-sort");
		const result1 = selectAvailableYears(unit);
		const result2 = selectAvailableYears(unit);
		expect(result1).toBe(result2); // Should be the same array instance
	});

	it("selectExamNumbers returns year-specific mappings", () => {
		const unit = selectUnitByKey(unitBasedTabs, "unit-automaton");
		expect(selectExamNumbers(unit, "2016")).toEqual([4, 6]);
	});

	it("selectActiveExamNumber falls back to first available exam", () => {
		expect(selectActiveExamNumber([3, 4], 8)).toBe(3);
		expect(selectActiveExamNumber([], 8)).toBeNull();
	});

	it("selectFallbackYear returns first valid year when current is unavailable", () => {
		const unit = selectUnitByKey(unitBasedTabs, "unit-sort");
		expect(selectFallbackYear(unit, "2017" as Year)).toBe("2013");
		expect(selectFallbackYear(unit, "2014")).toBeUndefined();
	});

	it("selectExamSwitchItems resolves exam titles", () => {
		const items = selectExamSwitchItems([4, 7], "2016");
		expect(items).toEqual([
			{ examNumber: 4, title: "オートマトン・符号理論 (2016)" },
			{ examNumber: 7, title: "符号理論 (2016)" },
		]);
	});
});
