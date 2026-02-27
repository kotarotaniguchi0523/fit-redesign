import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClipboard } from "./useClipboard";

describe("useClipboard stability", () => {
	it("returns a stable object reference across re-renders", () => {
		const { result, rerender } = renderHook(() => useClipboard());
		const firstResult = result.current;

		rerender();

		const secondResult = result.current;
		expect(secondResult).toBe(firstResult);
	});
});
