import type { Page } from "playwright/test";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { createAppServer } from "./server.ts";

/**
 * 主要導線の E2E。`remix test` はテストごとにテストサーバーとブラウザーページを
 * 起動・終了する。`createAppServer()` が `public/` を配信するため島も hydrate する。
 *
 * ホームの単元名はリンクではなく、リンクは年度（`/unit-.../<year>`）である点に注意。
 */

/** 調査用: ブラウザーのコンソール・エラー・失敗リクエストを出力する。 */
function trace(page: Page): void {
	page.on("console", (message) => {
		console.log("[browser]", message.type(), message.text().slice(0, 200));
	});
	page.on("pageerror", (error) => {
		console.log("[browser error]", String(error.message).slice(0, 300));
	});
	page.on("requestfailed", (request) => {
		console.log("[request failed]", request.url(), request.failure()?.errorText);
	});
}

describe("サイト導線", () => {
	it("トップページに単元・年度リンク・ヘッダーが描画される", async (t) => {
		const page = await t.serve(await createAppServer());
		trace(page);

		await page.goto("/");
		await page.getByRole("heading", { name: "問題を選ぶ" }).waitFor();
		await page.getByRole("navigation", { name: "メインナビゲーション" }).waitFor();
		await page.getByText("基数変換").first().waitFor();
		await page.getByRole("link", { name: "2013" }).first().waitFor();
	});

	it("トップ → 単元 → 単問へリンクで移動できる（SSR 導線）", async (t) => {
		const page = await t.serve(await createAppServer());
		trace(page);

		await page.goto("/");
		await page.getByRole("link", { name: "2017" }).first().click();
		await page.getByRole("heading", { name: "基数変換", exact: true }).waitFor();

		await page.getByRole("link", { name: "問1" }).first().click();
		await page.locator("[data-player]").waitFor();
	});

	it("小テストプレイヤーで解答を開き、自己判定できる（島が hydrate する）", async (t) => {
		const page = await t.serve(await createAppServer());
		trace(page);

		await page.goto("/unit-base-conversion/2017/exam/1");
		const reveal = page.getByRole("button", { name: "解答を表示" });
		await reveal.waitFor();
		await reveal.click();
		await page.getByText("解答", { exact: true }).waitFor();

		await page.getByRole("button", { name: "正解として記録" }).click();
		assert.ok(true);
	});

	it("問題一覧ドロワが開く", async (t) => {
		const page = await t.serve(await createAppServer());
		trace(page);

		await page.goto("/unit-base-conversion/2017/exam/1");
		await page.getByRole("button", { name: "問題一覧を開く" }).click();
		await page.getByRole("complementary", { name: "問題一覧" }).waitFor();
	});

	it("狭い画面ではアコーディオンで年度を選べる", async (t) => {
		const page = await t.serve(await createAppServer());
		trace(page);
		await page.setViewportSize({ width: 390, height: 800 });

		await page.goto("/");
		await page
			.getByRole("button", { name: /基数変換/ })
			.first()
			.click();
		await page.getByRole("link", { name: "2017年度" }).first().waitFor();
	});
});
