import { describe, it } from "vitest";
import { selectAvailableYears, selectFallbackYear } from "./unitTabsSelectors";
import type { UnitBasedTab, Year, ExamNumber } from "../types";

// Helper to generate large dataset
function createLargeUnit(count: number): UnitBasedTab {
    const examMapping = Array.from({ length: count }, (_, i) => ({
        year: `year-${i}` as Year,
        examNumbers: [1] as ExamNumber[],
    }));

    return {
        id: "unit-perf-test",
        name: "Perf Test",
        title: "Perf Test",
        icon: "🧪",
        description: "Performance testing unit",
        slides: [],
        examMapping,
    } as unknown as UnitBasedTab;
}

describe("unitTabsSelectors Performance", () => {
    it("benchmark selectAvailableYears and selectFallbackYear with large dataset", () => {
        const size = 10000;
        const largeUnit = createLargeUnit(size);
        const targetYear = `year-${size + 1}` as Year; // Not in the list

        const iterations = 1000;

        const startAvailable = performance.now();
        for (let i = 0; i < iterations; i++) {
            selectAvailableYears(largeUnit);
        }
        const endAvailable = performance.now();
        console.log(`selectAvailableYears x ${iterations} (size=${size}): ${(endAvailable - startAvailable).toFixed(2)}ms`);

        const startFallback = performance.now();
        for (let i = 0; i < iterations; i++) {
            selectFallbackYear(largeUnit, targetYear);
        }
        const endFallback = performance.now();
        console.log(`selectFallbackYear x ${iterations} (size=${size}): ${(endFallback - startFallback).toFixed(2)}ms`);
    });
});
