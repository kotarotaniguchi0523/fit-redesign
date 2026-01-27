import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClipboard } from "./useClipboard";

describe("useClipboard", () => {
	const originalClipboard = navigator.clipboard;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		Object.defineProperty(navigator, "clipboard", {
			value: originalClipboard,
			writable: true,
			configurable: true,
		});
	});

	it("初期状態で isCopied が false", () => {
		const { result } = renderHook(() => useClipboard());
		expect(result.current.isCopied).toBe(false);
	});

	it("初期状態で error が false", () => {
		const { result } = renderHook(() => useClipboard());
		expect(result.current.error).toBe(false);
	});

	describe("コピー成功", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "clipboard", {
				value: { writeText: vi.fn().mockResolvedValue(undefined) },
				writable: true,
				configurable: true,
			});
		});

		it("copy は true を返す", async () => {
			const { result } = renderHook(() => useClipboard());
			let success = false;
			await act(async () => {
				success = await result.current.copy("text");
			});
			expect(success).toBe(true);
		});

		it("コピー成功後は isCopied が true", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			expect(result.current.isCopied).toBe(true);
		});

		it("コピー成功後は error が false", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			expect(result.current.error).toBe(false);
		});

		it("2 秒経過で isCopied が false", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			act(() => {
				vi.advanceTimersByTime(2000);
			});
			expect(result.current.isCopied).toBe(false);
		});
	});

	describe("コピー失敗", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "clipboard", {
				value: { writeText: vi.fn().mockRejectedValue(new Error("oops")) },
				writable: true,
				configurable: true,
			});
		});

		it("copy は false を返す", async () => {
			const { result } = renderHook(() => useClipboard());
			let success = true;
			await act(async () => {
				success = await result.current.copy("text");
			});
			expect(success).toBe(false);
		});

		it("コピー失敗後は error が true", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			expect(result.current.error).toBe(true);
		});

		it("2 秒経過で error が false", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			act(() => {
				vi.advanceTimersByTime(2000);
			});
			expect(result.current.error).toBe(false);
		});
	});

	describe("Clipboard API 未対応", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "clipboard", {
				value: undefined,
				writable: true,
				configurable: true,
			});
		});

		it("copy は false を返す", async () => {
			const { result } = renderHook(() => useClipboard());
			let success = true;
			await act(async () => {
				success = await result.current.copy("text");
			});
			expect(success).toBe(false);
		});

		it("Clipboard API 非対応時は error が true", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			expect(result.current.error).toBe(true);
		});

		it("2 秒経過で error が false", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("text");
			});
			act(() => {
				vi.advanceTimersByTime(2000);
			});
			expect(result.current.error).toBe(false);
		});
	});

	describe("連続コピー", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "clipboard", {
				value: { writeText: vi.fn().mockResolvedValue(undefined) },
				writable: true,
				configurable: true,
			});
		});

		it("2 回目のコピーから1秒後も isCopied が true", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("first");
			});
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			await act(async () => {
				await result.current.copy("second");
			});
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(result.current.isCopied).toBe(true);
		});

		it("2 回目のコピーから2秒後に isCopied が false", async () => {
			const { result } = renderHook(() => useClipboard());
			await act(async () => {
				await result.current.copy("first");
			});
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			await act(async () => {
				await result.current.copy("second");
			});
			act(() => {
				vi.advanceTimersByTime(2000);
			});
			expect(result.current.isCopied).toBe(false);
		});
	});
});
