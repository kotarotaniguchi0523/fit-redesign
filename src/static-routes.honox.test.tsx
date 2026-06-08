/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import index from "../app/routes/index";
import guide from "../app/routes/guide";
import notFound from "../app/routes/_404";
import dashboardIndex from "../app/routes/dashboard/index";
import slideOnly from "../app/routes/slide-only";

/**
 * 静的ページルート（home / guide / slide-only / 404 / dashboard index）の
 * 古典派 integration テスト（AAA）。
 *
 * 本番では honox の createApp() が _renderer.tsx を全ページにミドルウェアとして適用するが、
 * vitest では createApp()（import.meta.glob 依存）と honox/server の Link/Script
 * アセット解決が動かない。そこで _renderer.tsx と同じ prop 契約
 * （title/description/jsonLd/noindex を受ける ContextRenderer）を持つ軽量レンダラを
 * jsxRenderer で再現し、各ルートの **HTML 出力と渡す props** を app.request() で検証する。
 *
 * ここで検証するのはルート自身が出す DOM（data-* 属性・見出し・JSON-LD・noindex）であり、
 * honox のアセットパイプライン（client.ts の配線）はスコープ外。
 */

// _renderer.tsx の prop 契約を再現する最小レンダラ。
// jsonLd / noindex / title を実際に DOM へ出すので、ルートが正しく props を渡したか検証できる。
const testRenderer = jsxRenderer(({ children, title, jsonLd, noindex }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
			{noindex ? <meta name="robots" content="noindex, follow" /> : null}
			{jsonLd ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: テスト用 JSON-LD 注入
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			) : null}
		</head>
		<body>{children}</body>
	</html>
));

// createRoute の戻り値はハンドラのタプル。honox 本番と同様に "/" へ spread マウントする。
type RouteHandlers = readonly [unknown, ...unknown[]];
function mountGet(handlers: RouteHandlers) {
	const app = new Hono();
	app.use("*", testRenderer);
	app.get("/", ...(handlers as never));
	return app;
}

describe("home（/）", () => {
	it("200 を返し、study-home の DOM と JSON-LD を描画する", async () => {
		const res = await mountGet(index).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("data-study-home");
		expect(html).toContain("data-manifest");
		expect(html).toContain("勉強が嫌いな日でも、まず今日のぶんだけ。");
		// JSON-LD（WebSite + Course）が渡されている
		expect(html).toContain('"@type":"WebSite"');
		expect(html).toContain('"@type":"Course"');
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountGet(index).request("/");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("単元別マニフェスト（9 単元）を today リンクとして描画する", async () => {
		const res = await mountGet(index).request("/");
		const html = await res.text();
		// 単元行は /today/{unitId} へリンクする
		expect(html).toContain('href="/today/unit-base-conversion"');
		// data-unit-row が複数（マニフェスト件数分）出力される
		const rowCount = (html.match(/data-unit-row=/g) ?? []).length;
		expect(rowCount).toBeGreaterThanOrEqual(9);
	});
});

describe("guide（/guide）", () => {
	it("200・タイトル・lobster.js ローダを描画する", async () => {
		const res = await mountGet(guide).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>使い方ガイド - 基本情報技術 I</title>");
		expect(html).toContain("hacknock.github.io/lobsterjs/lobster.js");
		expect(html).toContain('id="guide-content"');
	});
});

describe("slide-only（/slide-only）", () => {
	it("200・タイトル・単元タブ・講義スライドセクションを描画する", async () => {
		const res = await mountGet(slideOnly).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>講義資料のみ - 基本情報技術 I</title>");
		// 単元タブ（unitBasedTabs）が defaultYear へのリンクとして描画される
		expect(html).toContain('role="tablist"');
		expect(html).toContain("講義資料のみ");
		// SlideSection の見出し（PDF バッジ + 講義スライド）が描画される
		expect(html).toContain("講義スライド");
	});
});

describe("404（_404.tsx / NotFoundHandler）", () => {
	it("未定義パスで 404・noindex・案内文を返す", async () => {
		const app = new Hono();
		app.use("*", testRenderer);
		// 本番では honox の applyNotFound が _404.tsx の戻り値を status 404 で再ラップする
		// （honox/dist/server/server.js）。ハンドラ自身は c.render の既定 200 を返すため、
		// テストでも同じ再ラップを施して本番挙動を再現する。
		app.notFound(async (c) => {
			const response = await notFound(c);
			return new Response(response.body, { status: 404, headers: response.headers });
		});
		const res = await app.request("/this-does-not-exist");
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain("ページが見つかりません");
		expect(html).toContain('name="robots"');
	});
});

describe("dashboard index（/dashboard/）", () => {
	it("200・noindex・空状態 DOM・localStorage リダイレクトスクリプトを描画する", async () => {
		const res = await mountGet(dashboardIndex).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('id="dash-empty"');
		expect(html).toContain("まだ記録がありません");
		// localStorage キー（fit-exam-user-id）を読む inline script が埋め込まれる
		expect(html).toContain("fit-exam-user-id");
		expect(html).toContain('name="robots"');
	});
});
