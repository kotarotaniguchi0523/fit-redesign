import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnitTabs } from "./UnitTabs";
import * as selectors from "./unitTabsSelectors";

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
	// @ts-ignore
	return <UnitTabs selectedYear={year} onYearChange={setYear} />;
}

describe("UnitTabs", () => {
	it("renders without crashing", () => {
		render(<TestWrapper />);
		// Use specific role filtering or getAllByRole to avoid ambiguity if strict mode adds extra elements
		const tabs = screen.getAllByRole("tab");
		const testUnitTab = tabs.find(tab => tab.textContent === "Test Unit");
		expect(testUnitTab).toBeTruthy();
	});
});
