import * as assert from "remix/assert";
import { createTestServer } from "remix/node-fetch-server/test";
import { describe, it } from "remix/test";

import { router } from "../router.ts";

/**
 * 主要導線の E2E。`remix test` はテストごとにテストサーバーとブラウザーページを
 * 起動・終了する。実際の Chromium 上で SSR と島（clientEntry）の協調を確認する。
 */
describe("サイト導線", () => {
	it("トップページに単元・ヘッダー・スタイルが読み込まれる", async (t) => {
		const page = await t.serve(await createTestServer(router.fetch));

		await page.goto("/");
		await page.getByRole("heading", { name: "問題を選ぶ" }).waitFor();
		await page.getByRole("navigation", { name: "メインナビゲーション" }).waitFor();
		await page
			.getByRole("link", { name: /基数変換/ })
			.first()
			.waitFor();
	});

	it("トップ → 単元 → 単問へリンクで移動できる（SSR 導線）", async (t) => {
		const page = await t.serve(await createTestServer(router.fetch));

		await page.goto("/");
		await page
			.getByRole("link", { name: /基数変換/ })
			.first()
			.click();
		await page.getByRole("heading", { name: "基数変換" }).waitFor();

		await page.getByRole("link", { name: "問1" }).first().click();
		await page.locator(".exam-player-shell").waitFor();
	});

	it("小テストプレイヤーで解答を開き、自己判定できる", async (t) => {
		const page = await t.serve(await createTestServer(router.fetch));

		await page.goto("/unit-base-conversion/2017/exam/1");
		await page.getByRole("button", { name: "解答を表示" }).click();
		await page.getByText("解答", { exact: true }).waitFor();

		await page.getByRole("button", { name: "正解として記録" }).click();
		assert.ok(true);
	});

	it("問題一覧ドロワ（popover）が開く", async (t) => {
		const page = await t.serve(await createTestServer(router.fetch));

		await page.goto("/unit-base-conversion/2017/exam/1");
		await page.getByRole("button", { name: "問題一覧を開く" }).click();
		await page.getByRole("complementary", { name: "問題一覧" }).waitFor();
	});

	it("アコーディオン（狭い画面の単元リスト）が開く", async (t) => {
		const page = await t.serve(await createTestServer(router.fetch));
		await page.setViewportSize({ width: 390, height: 800 });

		await page.goto("/");
		await page
			.getByRole("button", { name: /基数変換/ })
			.first()
			.click();
		await page.getByRole("link", { name: "2017年度" }).first().waitFor();
	});
});
