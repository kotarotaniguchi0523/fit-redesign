import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_DURATION } from "../constants";

// copy-button.ts をインポートすると initCopyButtons() が実行される
import "./copy-button";

function createCopyButton(text = "コピーするテキスト"): HTMLButtonElement {
	const button = document.createElement("button");
	button.setAttribute("data-copy-button", "");
	button.setAttribute("data-copy-text", text);

	const icon = document.createElement("span");
	icon.setAttribute("data-copy-icon", "");
	icon.innerHTML = "<svg>clipboard</svg>";
	button.appendChild(icon);

	document.body.appendChild(button);
	return button;
}

describe("copy-button", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("クリップボードコピー", () => {
		it("ボタンクリックでクリップボードに書き込まれる", async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = createCopyButton("テストテキスト");
			button.click();

			await vi.advanceTimersByTimeAsync(0);

			expect(writeText).toHaveBeenCalledWith("テストテキスト");
		});

		it("data-copy-text がないボタンは無視される", () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = document.createElement("button");
			button.setAttribute("data-copy-button", "");
			// data-copy-text を設定しない
			document.body.appendChild(button);
			button.click();

			expect(writeText).not.toHaveBeenCalled();
		});

		it("data-copy-button がない要素のクリックは無視される", () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = document.createElement("button");
			button.setAttribute("data-copy-text", "テスト");
			document.body.appendChild(button);
			button.click();

			expect(writeText).not.toHaveBeenCalled();
		});
	});

	describe("成功フィードバック", () => {
		it("コピー成功時に緑色のクラスが付与される", async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
			});

			const button = createCopyButton();
			button.click();

			await vi.advanceTimersByTimeAsync(0);

			expect(button.classList.contains("text-green-600")).toBe(true);
		});

		it("コピー成功時にチェックアイコンに変わる", async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
			});

			const button = createCopyButton();
			button.click();

			await vi.advanceTimersByTimeAsync(0);

			const icon = button.querySelector("[data-copy-icon]")!;
			expect(icon.innerHTML).toContain("m4.5 12.75 6 6 9-13.5"); // チェックマークSVG
		});

		it("フィードバックが一定時間後に元に戻る", async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
			});

			const button = createCopyButton();
			button.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(button.classList.contains("text-green-600")).toBe(true);

			vi.advanceTimersByTime(FEEDBACK_DURATION);

			expect(button.classList.contains("text-green-600")).toBe(false);
			expect(button.dataset.copying).toBeUndefined();
		});
	});

	describe("失敗フィードバック", () => {
		it("コピー失敗時に赤色のクラスが付与される", async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockRejectedValue(new Error("fail")) },
			});

			const button = createCopyButton();
			button.click();

			await vi.advanceTimersByTimeAsync(0);

			expect(button.classList.contains("text-red-600")).toBe(true);
		});

		it("navigator.clipboard が存在しない場合はエラーフィードバック", () => {
			Object.assign(navigator, { clipboard: undefined });

			const button = createCopyButton();
			button.click();

			expect(button.classList.contains("text-red-600")).toBe(true);
		});

		it("失敗フィードバックも一定時間後に元に戻る", async () => {
			Object.assign(navigator, {
				clipboard: { writeText: vi.fn().mockRejectedValue(new Error("fail")) },
			});

			const button = createCopyButton();
			button.click();

			await vi.advanceTimersByTimeAsync(0);
			expect(button.classList.contains("text-red-600")).toBe(true);

			vi.advanceTimersByTime(FEEDBACK_DURATION);

			expect(button.classList.contains("text-red-600")).toBe(false);
		});
	});

	describe("連続クリック防止", () => {
		it("フィードバック中の再クリックは無視される", async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = createCopyButton();
			button.click();
			await vi.advanceTimersByTimeAsync(0);

			// フィードバック中に再クリック
			button.click();
			await vi.advanceTimersByTimeAsync(0);

			expect(writeText).toHaveBeenCalledTimes(1);
		});

		it("フィードバック完了後は再クリック可能", async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = createCopyButton();
			button.click();
			await vi.advanceTimersByTimeAsync(0);

			vi.advanceTimersByTime(FEEDBACK_DURATION);

			button.click();
			await vi.advanceTimersByTimeAsync(0);

			expect(writeText).toHaveBeenCalledTimes(2);
		});
	});

	describe("イベント委譲", () => {
		it("子要素のクリックでも親ボタンが検出される", async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, {
				clipboard: { writeText },
			});

			const button = createCopyButton("委譲テスト");
			const icon = button.querySelector("[data-copy-icon]") as HTMLSpanElement;

			icon.click();
			await vi.advanceTimersByTimeAsync(0);

			expect(writeText).toHaveBeenCalledWith("委譲テスト");
		});
	});
});
