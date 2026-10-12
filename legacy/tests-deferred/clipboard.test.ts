import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
// TODO: convert vi.* usage to `t.mock.*`

import { writeClipboardText } from "./clipboard.ts";

describe("writeClipboardText", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes text and reports success", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

		await expect(writeClipboardText("共有する文字列")).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith("共有する文字列");
	});

	it("reports denied clipboard access without throwing", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
		});

		await expect(writeClipboardText("共有する文字列")).resolves.toBe(false);
	});
});
