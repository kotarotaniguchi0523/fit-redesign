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
function mountGet(handlers: RouteHandlers): Hono {
	const app = new Hono();
	app.use("*", testRenderer);
	app.get("/", ...handlers);
	return app;
}

describe("home（/）", () => {
	it("200 を返し、単元と年度の表と JSON-LD を描画する", async () => {
		const res = await mountGet(index).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("問題を選ぶ");
		expect(html).toContain('href="/unit-base-conversion/2013"');
		// JSON-LD（WebSite + Course）が渡されている
		expect(html).toContain('"@type":"WebSite"');
		expect(html).toContain('"@type":"Course"');
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountGet(index).request("/");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("複数小テストの年度には件数を表示する", async () => {
		const res = await mountGet(index).request("/");
		const html = await res.text();
		expect(html).toContain("2テスト");
		expect(html).not.toContain("3テスト");
		expect(html).not.toContain("/today/");
	});
});

describe("exercises（/exercises）", () => {
	it("ホームへ301リダイレクトする", async () => {
		const res = await mountGet(exercises).request("/");
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("/");
	});
});

describe("guide（/guide）", () => {
	it("200・タイトル・MDX 本文を SSR で描画する（外部 lobster.js 非依存）", async () => {
		const res = await mountGet(guide).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>使い方ガイド - 基本情報技術 I</title>");
		// MDX 本文がサーバー側で HTML 化されている。
		expect(html).toContain("問題の答えを確認する");
		expect(html).toContain("単元");
		expect(html).toContain("答えを確認する");
		expect(html).toContain("コピーしました");
		expect(html).not.toContain("**「");
		// 外部 CDN（lobster.js）への依存が無いこと。
		expect(html).not.toContain("hacknock.github.io");
	});
});

describe("slide-only（/slide-only）", () => {
	it("200・タイトル・折りたたみ単元選択・講義スライドを描画する", async () => {
		const res = await mountGet(slideOnly).request("/");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<title>講義資料 - 基本情報技術 I</title>");
		// 常時タブではなく、必要時に開く単元選択として描画される
		expect(html).toContain("単元を選択");
		expect(html).toContain('class="study-navigator');
		expect(html).toContain("講義資料");
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

describe("dashboard index（/dashboard）", () => {
	it("/records へ301リダイレクトする", async () => {
		const res = await mountGet(dashboardIndex).request("/");
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("/records");
	});
});
