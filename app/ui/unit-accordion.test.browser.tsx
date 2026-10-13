import * as assert from "remix/assert";
import { render } from "remix/component/test";
import { describe, it } from "remix/test";

import { UnitAccordion } from "./unit-accordion.tsx";

const UNITS = [
	{ id: "unit-base-conversion", icon: "🔢", name: "基数変換", years: ["2017", "2016"] },
] as const;

/**
 * ホームの単元アコーディオン（clientEntry）のブラウザーコンポーネントテスト。
 *
 * サーバー描画では閉じた状態（`data-state="closed"` → `display: none`）なので、
 * 開閉が実際に効くことを島の境界で確認する。
 */
describe("UnitAccordion", () => {
	it("単元を開くと年度リンクが現れる", async (t) => {
		const { $, act, cleanup } = render(<UnitAccordion units={UNITS} />);
		t.after(cleanup);

		const trigger = $("button");
		assert.ok(trigger instanceof HTMLButtonElement);
		assert.equal(trigger.textContent?.includes("基数変換"), true);

		assert.equal($('[data-state="open"]'), null, "初期状態は閉じている");

		await act(() => trigger.click());

		assert.ok($('[data-state="open"]'), "パネルが開く");
		assert.ok($('a[href="/unit-base-conversion/2017"]'), "年度リンクが描画されている");
	});
});
