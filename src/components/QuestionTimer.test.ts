import { describe, expect, it } from "vitest";
import { formatTime } from "../utils/timeFormat";

describe("formatTime", () => {
	it("0秒を00:00に変換", () => {
		expect(formatTime(0)).toBe("00:00");
	});

	it("59秒を00:59に変換", () => {
		expect(formatTime(59)).toBe("00:59");
	});

	it("60秒を01:00に変換", () => {
		expect(formatTime(60)).toBe("01:00");
	});

	it("3661秒を61:01に変換", () => {
		expect(formatTime(3661)).toBe("61:01");
	});

	it("ゼロパディングが正しく適用される（1分5秒）", () => {
		expect(formatTime(65)).toBe("01:05");
	});

	it("ゼロパディングが正しく適用される（10分5秒）", () => {
		expect(formatTime(605)).toBe("10:05");
	});
});
