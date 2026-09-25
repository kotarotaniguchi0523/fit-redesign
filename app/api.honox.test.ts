// @vitest-environment node
import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import health from "./routes/health";
import markdown from "./routes/markdown";
import { requestLoggingMiddleware } from "./server/requestLogging";
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
	const app = new Hono();
	app.use("*", ...requestLoggingMiddleware);
	app.use(trimTrailingSlash());
	app.get("/health", ...health);
	app.route("/markdown", markdown);
	return app;
}

beforeAll(async () => {
	database = await createTestD1();
});

afterAll(async () => {
	await database?.dispose();
});

afterEach(() => {
	vi.restoreAllMocks();
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

	it("request-idを付与し、Server-Timingは付与しない", async () => {
		const response = await mountedApp().request("/health", {}, env());
		expect(response.headers.get("X-Request-Id")).toBeTruthy();
		expect(response.headers.get("Server-Timing")).toBeNull();
	});

	it("構造化ログは最終statusとrequest-idを記録し、クエリを含めない", async () => {
		const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
		const response = await mountedApp().request("/health?sync-key=must-not-be-logged", {}, env());
		const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;

		expect(log).toHaveBeenCalledOnce();
		expect(entry).toMatchObject({
			requestId: response.headers.get("X-Request-Id"),
			method: "GET",
			path: "/health",
			status: 200,
		});
		expect(entry.durationMs).toEqual(expect.any(Number));
		expect(JSON.stringify(entry)).not.toContain("must-not-be-logged");
	});

	it("末尾スラッシュの301を最終statusとして記録する", async () => {
		const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
		const response = await mountedApp().request("/health/", {}, env());
		const entry = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;

		expect(response.status).toBe(301);
		expect(entry.status).toBe(301);
	});
});
