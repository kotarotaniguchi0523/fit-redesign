import { describe, expect, it } from "vitest";
import { formatTime } from "./timeFormat";

describe("formatTime", () => {
	it("0秒を 00:00 にフォーマットする", () => {
		expect(formatTime(0)).toBe("00:00");
	});

	it("59秒を 00:59 にフォーマットする", () => {
		expect(formatTime(59)).toBe("00:59");
	});

	it("60秒を 01:00 にフォーマットする", () => {
		expect(formatTime(60)).toBe("01:00");
	});

	it("61秒を 01:01 にフォーマットする", () => {
		expect(formatTime(61)).toBe("01:01");
	});

	it("3661秒を 61:01 にフォーマットする（60分超え）", () => {
		expect(formatTime(3661)).toBe("61:01");
	});

	it("1桁の分・秒をゼロパディングする", () => {
		expect(formatTime(5)).toBe("00:05");
		expect(formatTime(65)).toBe("01:05");
	});

	it("大きな値でも正しくフォーマットする", () => {
		expect(formatTime(5999)).toBe("99:59");
		expect(formatTime(6000)).toBe("100:00");
	});
});
