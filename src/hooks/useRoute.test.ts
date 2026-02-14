import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePath, useRoute } from "./useRoute";

describe("normalizePath", () => {
	it("ルート / はそのまま返す", () => {
		expect(normalizePath("/")).toBe("/");
	});

	it("末尾スラッシュなしのパスはそのまま返す", () => {
		expect(normalizePath("/guide")).toBe("/guide");
	});

	it("末尾スラッシュを1つ除去する", () => {
		expect(normalizePath("/guide/")).toBe("/guide");
	});

	it("末尾の複数スラッシュをすべて除去する", () => {
		expect(normalizePath("/guide//")).toBe("/guide");
		expect(normalizePath("/guide///")).toBe("/guide");
	});

	it("空文字列はそのまま返す", () => {
		expect(normalizePath("")).toBe("");
	});
});

describe("useRoute", () => {
	beforeEach(() => {
		window.history.replaceState(null, "", "/");
	});

	it("現在のパスを返す", () => {
		const { result } = renderHook(() => useRoute());
		expect(result.current.path).toBe("/");
	});

	it("navigate で SPA 遷移できる", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("/guide");
		});

		expect(result.current.path).toBe("/guide");
		expect(window.location.pathname).toBe("/guide");
	});

	it("// で始まるパスへの遷移を拒否する", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("//evil.com");
		});

		expect(result.current.path).toBe("/");
	});

	it("/ で始まらないパスへの遷移を拒否する", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("https://evil.com");
		});

		expect(result.current.path).toBe("/");
	});

	it("navigate は末尾スラッシュを正規化して遷移する", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("/guide/");
		});

		expect(result.current.path).toBe("/guide");
		expect(window.location.pathname).toBe("/guide");
	});

	it("navigate は複数末尾スラッシュも正規化する", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("/guide///");
		});

		expect(result.current.path).toBe("/guide");
		expect(window.location.pathname).toBe("/guide");
	});

	it("正規化後に同じパスなら pushState を呼ばない", () => {
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("/guide");
		});

		const spy = vi.spyOn(window.history, "pushState");

		act(() => {
			result.current.navigate("/guide/");
		});

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("同じパスへの遷移は pushState を呼ばない", () => {
		const spy = vi.spyOn(window.history, "pushState");
		const { result } = renderHook(() => useRoute());

		act(() => {
			result.current.navigate("/");
		});

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	afterEach(() => {
		window.history.replaceState(null, "", "/");
	});
});
