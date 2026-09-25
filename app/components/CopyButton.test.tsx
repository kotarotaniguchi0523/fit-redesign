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

		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector('[role="menuitem"]')).not.toBeNull());
		container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
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

		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector('[role="menuitem"]')).not.toBeNull());
		container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
		await vi.waitFor(() => expect(container.textContent).toContain("コピーできませんでした"));
	});

	it("連続コピーでは最後の操作から一定時間フィードバックを表示する", async () => {
		vi.useFakeTimers();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		});
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<CopyButton text="問題" className="copy" ariaLabel="コピー" title="コピー" />,
			container,
		);

		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector('[role="menuitem"]')).not.toBeNull());
		container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
		await vi.waitFor(() => expect(container.textContent).toContain("コピーしました"));
		await vi.advanceTimersByTimeAsync(1000);
		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector('[role="menuitem"]')).not.toBeNull());
		container.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
		await vi.advanceTimersByTimeAsync(1000);
		expect(container.textContent).toContain("コピーしました");
		await vi.advanceTimersByTimeAsync(1000);
		expect(container.textContent).toContain("Markdownでコピー");
	});

	it("AIメニューからChatGPTとGeminiへ質問文を渡す", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<CopyButton
				text="## 問題\n\n### 解答\nエックス"
				askText="## 問題\n\n2 + 2"
				className="copy"
				ariaLabel="コピー"
				title="コピー"
			/>,
			container,
		);

		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector("div.copy-ai-menu")).not.toBeNull());
		expect(container.querySelectorAll('[aria-haspopup="menu"]')).toHaveLength(1);
		expect(container.querySelectorAll(".copy-control__menu-button")).toHaveLength(0);

		const chatGptLink = container.querySelector<HTMLAnchorElement>(
			'a[href^="https://chatgpt.com/?q="]',
		);
		const geminiLink = container.querySelector<HTMLAnchorElement>(
			'a[href^="https://gemini.google.com/app?q="]',
		);
		expect(chatGptLink).not.toBeNull();
		expect(chatGptLink?.target).toBe("_blank");
		const askPrompt = new URL(chatGptLink?.href ?? "").searchParams.get("q") ?? "";
		expect(askPrompt).toContain("2 + 2");
		expect(askPrompt).not.toContain("### 解答");
		expect(askPrompt).not.toContain("エックス");
		expect(geminiLink).not.toBeNull();
		expect(geminiLink?.target).toBe("_blank");
		const geminiPrompt = new URL(geminiLink?.href ?? "").searchParams.get("q") ?? "";
		expect(geminiPrompt).toContain("2 + 2");
		expect(geminiPrompt).not.toContain("### 解答");
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		geminiLink?.addEventListener("click", (event) => event.preventDefault());
		geminiLink?.click();
		await vi.waitFor(() => expect(container.querySelector("div.copy-ai-menu")).toBeNull());
		expect(writeText).not.toHaveBeenCalled();
	});

	it("Geminiへ渡すURLが長すぎる場合は本文をコピーする", async () => {
		const longQuestion = "問題文".repeat(400);
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(
			<CopyButton
				text={longQuestion}
				askText={longQuestion}
				className="copy"
				ariaLabel="コピー"
				title="コピー"
			/>,
			container,
		);

		container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.click();
		await vi.waitFor(() => expect(container.querySelector("div.copy-ai-menu")).not.toBeNull());
		const geminiLink = container.querySelector<HTMLAnchorElement>(
			'a[href="https://gemini.google.com/app"]',
		);
		expect(geminiLink).not.toBeNull();
		geminiLink?.addEventListener("click", (event) => event.preventDefault());
		geminiLink?.click();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining(longQuestion));
	});
});
