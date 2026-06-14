import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./data/site";
import llmsTxt from "./routes/llms.txt";
import robotsTxt from "./routes/robots.txt";

/**
 * テキストルート（robots.txt / llms.txt）の integration テスト。
 *
 * テキストルートは renderer 不要。createRoute の戻り値を "/" に spread マウントし
 * app.request("/") で 200・Content-Type・ボディ内容を検証する。
 */

// createRoute の戻り値はハンドラのタプル。"/robots.txt" 等の拡張子付きルートも同様にマウントできる。
type RouteHandlers = readonly [unknown, ...unknown[]];
function mountGet(handlers: RouteHandlers): Hono {
	const app = new Hono();
	app.get("/", ...(handlers as never));
	return app;
}

describe("robots.txt ルート", () => {
	it("200 を返し Content-Type が text/plain である", async () => {
		const res = await mountGet(robotsTxt).request("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("text/plain");
	});

	it("Cache-Control ヘッダを付与する", async () => {
		const res = await mountGet(robotsTxt).request("/");
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
	});

	it(`Sitemap: ${SITE_URL}/sitemap.xml を含む`, async () => {
		const res = await mountGet(robotsTxt).request("/");
		const body = await res.text();
		expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
	});

	it("Disallow: /answer/ と Disallow: /dashboard/ を含む", async () => {
		const res = await mountGet(robotsTxt).request("/");
		const body = await res.text();
		expect(body).toContain("Disallow: /answer/");
		expect(body).toContain("Disallow: /dashboard/");
	});

	it("廃止済み /timer/ の Disallow を含まない", async () => {
		const res = await mountGet(robotsTxt).request("/");
		const body = await res.text();
		expect(body).not.toContain("/timer/");
	});

	it("AI 検索ボット（ClaudeBot）の Allow: / を含む", async () => {
		const res = await mountGet(robotsTxt).request("/");
		const body = await res.text();
		expect(body).toContain("User-agent: ClaudeBot");
		// ClaudeBot セクションの Allow を確認
		const claudeIndex = body.indexOf("User-agent: ClaudeBot");
		const afterClaude = body.slice(claudeIndex);
		expect(afterClaude.startsWith("User-agent: ClaudeBot\nAllow: /")).toBe(true);
	});
});

describe("llms.txt ルート", () => {
	it("200 を返し Content-Type が text/plain である", async () => {
		const res = await mountGet(llmsTxt).request("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("text/plain");
	});

	it("Cache-Control ヘッダを付与する", async () => {
		const res = await mountGet(llmsTxt).request("/");
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
	});

	it(`SITE_URL（${SITE_URL}）を含む`, async () => {
		const res = await mountGet(llmsTxt).request("/");
		const body = await res.text();
		expect(body).toContain(SITE_URL);
	});

	it("単元タイトル（単元1: 基数変換）を含む", async () => {
		const res = await mountGet(llmsTxt).request("/");
		const body = await res.text();
		expect(body).toContain("単元1: 基数変換");
	});

	it("単元ページ URL が末尾スラッシュ無しで出力される", async () => {
		const res = await mountGet(llmsTxt).request("/");
		const body = await res.text();
		// 末尾スラッシュ無し URL が含まれる
		expect(body).toContain(`${SITE_URL}/unit-base-conversion/2013`);
		// 末尾スラッシュ付き URL を含まない
		expect(body).not.toContain(`${SITE_URL}/unit-base-conversion/2013/`);
	});

	it("旧技術情報（Astro / Cloudflare Pages）を含まない", async () => {
		const res = await mountGet(llmsTxt).request("/");
		const body = await res.text();
		expect(body).not.toContain("Astro");
		expect(body).not.toContain("Cloudflare Pages");
	});

	it("現行技術情報（HonoX / Cloudflare Workers）を含む", async () => {
		const res = await mountGet(llmsTxt).request("/");
		const body = await res.text();
		expect(body).toContain("HonoX");
		expect(body).toContain("Cloudflare Workers");
	});
});
