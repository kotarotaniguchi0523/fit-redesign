/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ClientScript, resolveClientSrc } from "../app/client-script";

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

/**
 * 本番の manifest 解決ロジック（resolveClientSrc）の単体テスト。
 * ClientScript の本番分岐は vitest（PROD=false）では走らないため、
 * 解決ロジックを純関数として直接検証する。silent 失敗（manifest にエントリが
 * 無いと空 script になる本番バグの再発点）を明示的に固定する。
 */
describe("resolveClientSrc", () => {
	const manifest = { "app/client.ts": { file: "static/client-abc123.js" } };

	it("エントリをハッシュ付き実体パスへ解決する（BASE_URL='/'）", () => {
		expect(resolveClientSrc(manifest, "/app/client.ts", "/")).toBe("/static/client-abc123.js");
	});

	it("先頭スラッシュ無しの src でも解決する", () => {
		expect(resolveClientSrc(manifest, "app/client.ts", "/")).toBe("/static/client-abc123.js");
	});

	it("BASE_URL の末尾スラッシュ有無を吸収する", () => {
		expect(resolveClientSrc(manifest, "/app/client.ts", "/sub")).toBe(
			"/sub/static/client-abc123.js",
		);
		expect(resolveClientSrc(manifest, "/app/client.ts", "/sub/")).toBe(
			"/sub/static/client-abc123.js",
		);
	});

	it("manifest が undefined のとき undefined（空 script の silent 失敗点）", () => {
		expect(resolveClientSrc(undefined, "/app/client.ts", "/")).toBeUndefined();
	});

	it("エントリが存在しないとき undefined", () => {
		expect(resolveClientSrc(manifest, "/app/missing.ts", "/")).toBeUndefined();
	});
});
