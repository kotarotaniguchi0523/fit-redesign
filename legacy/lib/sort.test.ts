import { describe, expect, it } from "vitest";
import { sortNewestFirst } from "./sort";

describe("sortNewestFirst", () => {
	it("sorts by update time without mutating the source", () => {
		const older = { id: "older", updatedAt: 100 };
		const newer = { id: "newer", updatedAt: 200 };
		const values = [older, newer];

		expect(sortNewestFirst(values)).toEqual([newer, older]);
		expect(values).toEqual([older, newer]);
	});
});
