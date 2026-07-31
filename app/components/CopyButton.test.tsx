import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./$CopyButton";

describe("CopyButton", () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("Markdownをコピーして成功表示を元に戻す", async () => {
		vi.useFakeTimers();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<CopyButton text="問題" className="copy" ariaLabel="コピー" title="コピー" />,
			container,
		);

		container.querySelector("button")?.click();
		await vi.waitFor(() => expect(container.textContent).toContain("コピーしました"));
		expect(writeText).toHaveBeenCalledWith("問題");

		await vi.advanceTimersByTimeAsync(2000);
		expect(container.textContent).toContain("Markdownでコピー");
	});

	it("コピーに失敗したらエラーを表示する", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
		});
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<CopyButton text="問題" className="copy" ariaLabel="コピー" title="コピー" />,
			container,
		);

		container.querySelector("button")?.click();
		await vi.waitFor(() => expect(container.textContent).toContain("コピーできませんでした"));
	});
});
