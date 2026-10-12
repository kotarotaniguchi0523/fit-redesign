import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { sortByQuestionId } from "./questionOrder.ts";

describe("sortByQuestionId", () => {
	it("returns a sorted copy and leaves the original list unchanged", () => {
		const questions = [{ questionId: "q2" }, { questionId: "q1" }];

		assert.deepEqual(sortByQuestionId(questions), [{ questionId: "q1" }, { questionId: "q2" }]);
		assert.deepEqual(questions, [{ questionId: "q2" }, { questionId: "q1" }]);
	});
});
