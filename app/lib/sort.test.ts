import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { sortNewestFirst } from "./sort.ts";

describe("sortNewestFirst", () => {
	it("sorts by update time without mutating the source", () => {
		const older = { id: "older", updatedAt: 100 };
		const newer = { id: "newer", updatedAt: 200 };
		const values = [older, newer];

		assert.deepEqual(sortNewestFirst(values), [newer, older]);
		assert.deepEqual(values, [older, newer]);
	});
});
