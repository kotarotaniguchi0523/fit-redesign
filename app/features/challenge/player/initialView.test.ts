import { describe, expect, it } from "vitest";
import { readInitialChallengeView } from "./initialView";

describe("readInitialChallengeView", () => {
	it("uses the player view when no result query is present", () => {
		expect(readInitialChallengeView("")).toEqual({ view: "player", challengeId: undefined });
	});

	it("restores a result view only when the challenge ID is valid", () => {
		expect(
			readInitialChallengeView("?view=result&challenge=550e8400-e29b-41d4-a716-446655440000"),
		).toEqual({
			view: "result",
			challengeId: "550e8400-e29b-41d4-a716-446655440000",
		});
	});

	it("ignores malformed challenge IDs", () => {
		expect(readInitialChallengeView("?view=result&challenge=not-an-id")).toEqual({
			view: "result",
			challengeId: undefined,
		});
	});
});
