import { describe, expect, it } from "vitest";
import { isPlausibleSyncTimeRange, MAX_FUTURE_CLOCK_SKEW_MS } from "./syncTime";

describe("isPlausibleSyncTimeRange", () => {
	it("accepts ordered timestamps within the allowed clock skew", () => {
		expect(isPlausibleSyncTimeRange(100, 200, 200)).toBe(true);
		expect(isPlausibleSyncTimeRange(100, MAX_FUTURE_CLOCK_SKEW_MS, 0)).toBe(true);
	});

	it("rejects reversed timestamps and timestamps beyond the allowed clock skew", () => {
		expect(isPlausibleSyncTimeRange(201, 200, 200)).toBe(false);
		expect(isPlausibleSyncTimeRange(100, MAX_FUTURE_CLOCK_SKEW_MS + 1, 0)).toBe(false);
	});
});
