/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { raw } from "hono/html";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import index from "./routes";
import notFound from "./routes/_404";
import dashboardIndex from "./routes/dashboard";
import exercises from "./routes/exercises";
import guide from "./routes/guide";
import slideOnly from "./routes/slide-only";

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
			{jsonLd ? <script type="application/ld+json">{raw(JSON.stringify(jsonLd))}</script> : null}
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
		// 単元行のメイン導線は /today/{unitId}
		expect(html).toContain('href="/today/unit-base-conversion"');
		// 各行に演習ページ /unit-x/{主要年度} への「年度ごとに解く」サブリンクがある
		expect(html).toContain('href="/unit-base-conversion/2013"');
		expect(html).toContain("この単元の年度ごとに解く");
		// home-unit-row が複数（マニフェスト件数分）出力される
		const rowCount = (html.match(/class="home-unit-row"/g) ?? []).length;
		expect(rowCount).toBeGreaterThanOrEqual(9);
	});
});

describe("exercises（/exercises）", () => {
	it("200・タイトル・年度ヘッダ・単元×年度の演習リンクを描画する", async () => {
		const res = await mountGet(exercises).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>年度・単元別 演習問題一覧 - 基本情報技術 I</title>");
		// 年度ヘッダ（2013〜2017）
		expect(html).toContain("2013");
		expect(html).toContain("2017");
		// 出題年度のセルは /unit-x/{year} の演習ページへリンクする
		expect(html).toContain('href="/unit-base-conversion/2013"');
		expect(html).toContain('href="/unit-base-conversion/2017"');
		// 浮動小数点は 2014 が無いため欠落セル（— マーカー）が出る
		expect(html).toContain("exercises-td-empty");
	});
});

describe("guide（/guide）", () => {
	it("200・タイトル・MDX 本文を SSR で描画する（外部 lobster.js 非依存）", async () => {
		const res = await mountGet(guide).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>使い方ガイド - 基本情報技術 I</title>");
		// MDX 本文がサーバー側で HTML 化されている（見出し・GFM テーブル）。
		expect(html).toContain("はじめに");
		expect(html).toContain("基数変換");
		expect(html).toContain("<table");
		// 外部 CDN（lobster.js）への依存が無いこと。
		expect(html).not.toContain("hacknock.github.io");
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
	it("Cookie userId のダッシュボードへリダイレクトする", async () => {
		const app = new Hono();
		app.use("*", testRenderer);
		app.use("*", async (c, next) => {
			c.set("userId", "550e8400-e29b-41d4-a716-446655440000");
			c.set("userIdCookieIssued", false);
			await next();
		});
		app.get("/", ...(dashboardIndex as never));

		const res = await app.request("/");
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/dashboard/550e8400-e29b-41d4-a716-446655440000");
	});
});
