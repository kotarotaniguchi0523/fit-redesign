import { describe, expect, it } from "vitest";
import { sortByQuestionId } from "./questionOrder";

describe("sortByQuestionId", () => {
	it("returns a sorted copy and leaves the original list unchanged", () => {
		const questions = [{ questionId: "q2" }, { questionId: "q1" }];

		expect(sortByQuestionId(questions)).toEqual([{ questionId: "q1" }, { questionId: "q2" }]);
		expect(questions).toEqual([{ questionId: "q2" }, { questionId: "q1" }]);
	});
});
