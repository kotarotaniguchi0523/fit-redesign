import { render } from "hono/jsx/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_KEY_STORAGE_KEY } from "../answer/progressClient";
import RecordsView from "./$RecordsView";

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
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, "working-key");
		history.replaceState(null, "", "/records#sync=invalid-key");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

		const container = document.createElement("div");
		document.body.appendChild(container);
		render(<RecordsView unitNames={{}} />, container);

		await vi.waitFor(() => {
			expect(container.textContent).toContain("同期リンクが無効です");
		});
		expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe("working-key");
	});

	it("新しい同期が成功した後に同期キーを保存する", async () => {
		localStorage.setItem(SYNC_KEY_STORAGE_KEY, "old-key");
		history.replaceState(null, "", "/records#sync=new-key");
		let resolveSync: ((response: Response) => void) | undefined;
		vi.spyOn(globalThis, "fetch").mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveSync = resolve;
				}),
		);

		const container = document.createElement("div");
		document.body.appendChild(container);
		render(<RecordsView unitNames={{}} />, container);

		await vi.waitFor(() => expect(resolveSync).toBeTypeOf("function"));
		expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe("old-key");

		resolveSync?.(Response.json({ entries: [] }));
		await vi.waitFor(() => {
			expect(localStorage.getItem(SYNC_KEY_STORAGE_KEY)).toBe("new-key");
		});
	});
});
