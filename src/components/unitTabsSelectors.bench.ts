import { describe, bench } from "vitest";
import { selectAvailableYears, selectFallbackYear } from "./unitTabsSelectors";
import type { UnitBasedTab, Year } from "../types";

const largeExamMapping = Array.from({ length: 50000 }, (_, i) => ({
  year: (2000 + i) as Year,
  examNumbers: [],
  integratedTitle: null
}));

const mockUnit: UnitBasedTab = {
  id: "mock-unit" as any,
  name: "Mock Unit",
  title: "Mock Unit",
  icon: "🔧",
  description: "Mock Unit",
  slides: [],
  examMapping: largeExamMapping
};

describe("unitTabsSelectors performance", () => {
  bench("selectAvailableYears", () => {
    selectAvailableYears(mockUnit);
  });

  bench("selectFallbackYear - not included", () => {
    selectFallbackYear(mockUnit, 1999 as Year);
  });

  bench("selectFallbackYear - included at end", () => {
    selectFallbackYear(mockUnit, 51999 as Year);
  });
});
