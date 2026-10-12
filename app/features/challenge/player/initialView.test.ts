import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readInitialChallengeView } from "./initialView.ts";

describe("readInitialChallengeView", () => {
	it("uses the player view when no result query is present", () => {
		assert.deepEqual(readInitialChallengeView(""), { view: "player", challengeId: undefined });
	});

	it("restores a result view only when the challenge ID is valid", () => {
		assert.deepEqual(
			readInitialChallengeView("?view=result&challenge=550e8400-e29b-41d4-a716-446655440000"),
			{
				view: "result",
				challengeId: "550e8400-e29b-41d4-a716-446655440000",
			},
		);
	});

	it("ignores malformed challenge IDs", () => {
		assert.deepEqual(readInitialChallengeView("?view=result&challenge=not-an-id"), {
			view: "result",
			challengeId: undefined,
		});
	});
});
