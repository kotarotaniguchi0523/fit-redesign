import { render } from "hono/jsx/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SyncSettings from "./$SyncSettings";
import { SYNC_KEY_STORAGE_KEY } from "./progressStorage";

describe("RecordsView の同期リンク受け入れ", () => {
	beforeEach(() => {
		localStorage.clear();
		history.replaceState(null, "", "/records");
		vi.spyOn(window, "confirm").mockReturnValue(true);
	});

	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it("新しい同期が失敗したら既存の同期キーを保持する", async () => {
		const workingKey = "a".repeat(43);
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, workingKey);
		history.replaceState(null, "", "/records#sync=invalid-key");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

		const container = document.createElement("div");
		document.body.appendChild(container);
		render(<SyncSettings origin="http://localhost" />, container);

		await vi.waitFor(() => {
			expect(container.textContent).toContain("同期リンクが無効です");
		});
		expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe(workingKey);
	});

	it("新しい同期が成功した後に同期キーを保存する", async () => {
		const oldKey = "a".repeat(43);
		const newKey = "b".repeat(43);
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, oldKey);
		history.replaceState(null, "", `/records#sync=${newKey}`);
		let resolveSync: ((response: Response) => void) | undefined;
		vi.spyOn(globalThis, "fetch").mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveSync = resolve;
				}),
		);

		const container = document.createElement("div");
		document.body.appendChild(container);
		render(<SyncSettings origin="http://localhost" />, container);

		await vi.waitFor(() => expect(resolveSync).toBeTypeOf("function"));
		expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe(oldKey);

		resolveSync?.(Response.json({ entries: [] }));
		await vi.waitFor(() => {
			expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe(newKey);
		});
	});
});
