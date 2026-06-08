/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ClientScript } from "../app/client-script";

/**
 * ClientScript の回帰テスト（AAA）。
 *
 * 背景: honox/server の <Script> は出力を HasIslands でラップしており、ルートが island を
 * import している時しか client バンドルを出力しない。その結果、island を持たないページ
 * （ホーム=進捗 / today=デイリーセッション / dashboard=chart.js / guide=コピー）で client
 * バンドルが一切読まれず、命令的コントローラが全て死ぬ本番バグが発生した。
 *
 * ClientScript はこの island gate を外した置き換えである。ここでは「island の有無に関わらず
 * 常に module script を出力する」という契約を public な入出力で固定する。これが破れると
 * （= 再び gate 付き Script に戻すと）非 island ページのクライアントが死ぬ。
 */
describe("ClientScript", () => {
	it("island の有無に依存せず module script を出力する（HasIslands gate なし）", async () => {
		// Arrange: island を一切 import しない素の Hono ルートに ClientScript を置く
		const app = new Hono().get("/", (c) => c.html(<ClientScript src="/app/client.ts" />));

		// Act
		const res = await app.request("/");
		const html = await res.text();

		// Assert: gate されず module script が出力される
		expect(html).toContain("<script");
		expect(html).toContain('type="module"');
		expect(html).toContain("/app/client.ts");
	});
});
