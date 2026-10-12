import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { isPlausibleSyncTimeRange, MAX_FUTURE_CLOCK_SKEW_MS } from "./syncTime.ts";

describe("isPlausibleSyncTimeRange", () => {
	it("accepts ordered timestamps within the allowed clock skew", () => {
		assert.equal(isPlausibleSyncTimeRange(100, 200, 200), true);
		assert.equal(isPlausibleSyncTimeRange(100, MAX_FUTURE_CLOCK_SKEW_MS, 0), true);
	});

	it("rejects reversed timestamps and timestamps beyond the allowed clock skew", () => {
		assert.equal(isPlausibleSyncTimeRange(201, 200, 200), false);
		assert.equal(isPlausibleSyncTimeRange(100, MAX_FUTURE_CLOCK_SKEW_MS + 1, 0), false);
	});
});
