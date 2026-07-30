// @vitest-environment node
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import apiMiddleware from "./routes/_middleware";
import health from "./routes/health";
import markdown from "./routes/markdown";
import { createTestD1, type TestD1 } from "./types/test/d1";

class AllowAllRateLimit implements RateLimit {
	limit(_options: RateLimitOptions): Promise<RateLimitOutcome> {
		return Promise.resolve({ success: true });
	}
}

let database: TestD1;

function env(): Cloudflare.Env {
	return {
		DB: database.binding,
		PROGRESS_RATE_LIMITER: new AllowAllRateLimit(),
	};
}

function mountedApp(): Hono {
	// biome-ignore lint/suspicious/noExplicitAny: HonoX handler配列をintegration testへマウントする
	const spread = (handlers: unknown): any => handlers as any;
	const app = new Hono();
	app.use("*", ...spread(apiMiddleware));
	app.get("/health", ...spread(health));
	app.route("/markdown", markdown);
	return app;
}

beforeAll(async () => {
	database = await createTestD1();
});

afterAll(async () => {
	await database?.dispose();
});

describe("API routes（HonoXマウント越し）", () => {
	it("GET /health は稼働状態を返す", async () => {
		const response = await mountedApp().request("/health", {}, env());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("GET /markdown はサイト概要をMarkdownで返す", async () => {
		const response = await mountedApp().request("/markdown", {}, env());
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
		expect((await response.text()).startsWith("# 基本情報技術 I - 明治大学 演習問題サイト")).toBe(
			true,
		);
	});

	it("markdown はETag一致時に304を返す", async () => {
		const first = await mountedApp().request("/markdown", {}, env());
		const etag = first.headers.get("ETag");
		expect(etag).toBeTruthy();

		const second = await mountedApp().request(
			"/markdown",
			{ headers: { "If-None-Match": etag ?? "" } },
			env(),
		);
		expect(second.status).toBe(304);
	});

	it("共通middlewareが観測ヘッダーを付与する", async () => {
		const response = await mountedApp().request("/health", {}, env());
		expect(response.headers.get("X-Request-Id")).toBeTruthy();
		expect(response.headers.get("Server-Timing")).toBeTruthy();
	});
});
