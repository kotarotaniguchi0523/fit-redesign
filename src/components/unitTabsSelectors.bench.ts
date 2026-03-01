import { bench, describe } from "vitest";
import type { UnitBasedTab, Year } from "../types";
import { selectAvailableYears, selectFallbackYear } from "./unitTabsSelectors";

const largeExamMapping = Array.from({ length: 50000 }, (_, i) => ({
	year: String(2000 + i) as Year,
	examNumbers: [],
	integratedTitle: undefined,
}));

const mockUnit: UnitBasedTab = {
	id: "unit-mock" as never,
	name: "Mock Unit",
	title: "Mock Unit",
	icon: "🔧",
	description: "Mock Unit",
	slides: [],
	examMapping: largeExamMapping,
};

describe("unitTabsSelectors performance", () => {
	bench("selectAvailableYears", () => {
		selectAvailableYears(mockUnit);
	});

	bench("selectFallbackYear - not included", () => {
		selectFallbackYear(mockUnit, "1999" as Year);
	});

	bench("selectFallbackYear - included at end", () => {
		selectFallbackYear(mockUnit, "51999" as Year);
	});
});
