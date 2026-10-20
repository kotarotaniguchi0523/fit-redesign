import { describe, expect, it } from "vitest";
import type { QuestionLocationGroup } from "./continueLearningTypes";
import { findQuestionLocation } from "./useContinueLearning";

describe("findQuestionLocation", () => {
	it("uses the first matching unit and reconstructs its existing question link", () => {
		const locationGroups: readonly QuestionLocationGroup[] = [
			{
				unitName: "集合と確率",
				year: "2013",
				hrefPrefix: "/unit-set-prob/2013#question-",
				questionIds: ["exam6-2013-q1", "exam6-2013-q2"],
			},
			{
				unitName: "オートマトン",
				year: "2013",
				hrefPrefix: "/unit-automaton/2013#question-",
				questionIds: ["exam6-2013-q1"],
			},
		];

		const location = findQuestionLocation(locationGroups, "exam6-2013-q1");

		expect(location).toEqual({
			questionId: "exam6-2013-q1",
			unitName: "集合と確率",
			year: "2013",
			href: "/unit-set-prob/2013#question-exam6-2013-q1",
		});
	});

	it("returns no location when the progress id is absent or unknown", () => {
		const locationGroups: readonly QuestionLocationGroup[] = [];

		expect(findQuestionLocation(locationGroups, undefined)).toBeUndefined();
		expect(findQuestionLocation(locationGroups, "exam6-2013-q1")).toBeUndefined();
	});
});
