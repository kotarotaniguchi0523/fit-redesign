import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnitTabs } from "./UnitTabs";
import type * as selectors from "./unitTabsSelectors";

// Mock dependencies to isolate UnitTabs logic
vi.mock("../components/ExamSection", () => ({
	ExamSection: () => <div data-testid="exam-section">Exam Content</div>,
}));
vi.mock("../components/SlideSection", () => ({
	SlideSection: () => <div data-testid="slide-section">Slide Content</div>,
}));
vi.mock("../components/YearSelector", () => ({
	YearSelector: () => <div data-testid="year-selector">Year Selector</div>,
}));
vi.mock("../data/exams", () => ({
	getExamByNumber: (num: number) => ({
		examNumber: num,
		title: `Exam ${num}`,
		exams: {
			"2013": { title: `Exam ${num} Content` },
		},
	}),
}));
vi.mock("../data/units", () => ({
	unitBasedTabs: [
		{
			id: "unit-test",
			name: "Test Unit",
			title: "Test Unit",
			icon: "🧪",
			description: "Unit for testing",
			slides: [],
			examMapping: [
				{
					year: "2013",
					examNumbers: [1, 2],
				},
			],
		},
	],
	slideOnlyUnits: [],
}));

// Mock the selector module to spy on calls
vi.mock("./unitTabsSelectors", async (importOriginal) => {
	const actual = await importOriginal<typeof selectors>();
	return {
		...actual,
		selectAvailableYears: vi.fn(actual.selectAvailableYears),
	};
});

import { selectAvailableYears } from "./unitTabsSelectors";

function TestWrapper() {
	const [year, setYear] = useState("2013");
	// @ts-expect-error
	return <UnitTabs selectedYear={year} onYearChange={setYear} />;
}

describe("UnitTabs Memoization", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("does not recalculate availableYears when changing exam number (internal state)", async () => {
		render(<TestWrapper />);

		// Initial render calls selectAvailableYears once
		expect(selectAvailableYears).toHaveBeenCalledTimes(1);

		// Find the exam switch buttons
		const switchButton2 = await screen.findByRole("tab", { name: /小テスト2/i });

		// Click to change exam number
		await act(async () => {
			fireEvent.click(switchButton2);
		});

		// After clicking, UnitTabs re-renders because state changed.
		// But selectAvailableYears should NOT be called again because of useMemo.
		expect(selectAvailableYears).toHaveBeenCalledTimes(1);
	});
});
