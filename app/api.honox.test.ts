import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import apiMiddleware from "./routes/_middleware";
import answer from "./routes/answer";
import health from "./routes/health";
import markdown from "./routes/markdown";
import timer from "./routes/timer";

/**
 * 分解した API ファイルルート（app/routes/**）の古典派 integration テスト（AAA）。
 *
 * 本番では HonoX が answer.ts / timer.ts（chained Hono sub-app）を /answer・/timer へマウントし、
 * _middleware.ts を `subApp.use("*")` で全ルートに適用する。vitest では createApp()
 * （import.meta.glob 依存）が動かないため、同じネスト構造（共通 mw、/markdown に etag）を手で
 * 再現し、外部 URL の HTTP 振る舞い（status・レスポンス形状・400/413/304・middleware ヘッダ）を
 * app.request() で検証する。
 *
 * out-of-process 依存（D1 / KV）は空データを返す fake を注入する。
 */

function makeFakeDb(): D1Database {
	const stmt = {
		bind: () => stmt,
		all: () => Promise.resolve({ results: [] }),
		run: () => Promise.resolve({ meta: { last_row_id: 1 }, success: true }),
		first: () => Promise.resolve(null),
	};
	return {
		prepare: () => stmt,
		batch: (stmts: unknown[]) => Promise.resolve(stmts.map(() => ({ results: [], success: true }))),
	} as unknown as D1Database;
}

function makeFakeKv(): KVNamespace {
	return {
		get: () => Promise.resolve(null),
		put: () => Promise.resolve(),
	} as unknown as KVNamespace;
}

function env() {
	return { DB: makeFakeDb(), CACHE: makeFakeKv() } as unknown as Cloudflare.Env;
}

/** HonoX のネスト sub-app マウントを忠実に再現した合成アプリ。 */
function mountedApp() {
	// biome-ignore lint/suspicious/noExplicitAny: テスト用に health ハンドラ配列を spread マウントする
	const spread = (handlers: unknown) => handlers as any;

	// API は /api プレフィックス無しで root 直下にマウントされる。_middleware は全ルートへ。
	// answer / timer は chained Hono sub-app として /answer・/timer に route マウントする。
	const app = new Hono();
	app.use("*", ...spread(apiMiddleware));
	app.get("/health", ...spread(health));
	app.route("/answer", answer);
	app.route("/timer", timer);
	app.route("/markdown", markdown);

	return app;
}

describe("外部 URL の一致（HonoX マウント越し）", () => {
	it("GET /health は { status: 'ok' } を返す", async () => {
		const res = await mountedApp().request("/health", {}, env());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});
});

describe("answer routes", () => {
	it("GET /answer/status は { statuses } を返す（D1 空→空マップ）", async () => {
		const res = await mountedApp().request("/answer/status?userId=u1", {}, env());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ statuses: {} });
	});

	it("GET /answer/status は userId 無しで 400（{ error, details } 形状）", async () => {
		const res = await mountedApp().request("/answer/status", {}, env());
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; details: unknown };
		expect(body.error).toBe("Invalid request");
		expect(Array.isArray(body.details)).toBe(true);
	});

	it("POST /answer/submit は { ok, answerId } を返す", async () => {
		const res = await mountedApp().request(
			"/answer/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: "u1",
					questionId: "exam1-2013-q1",
					selectedLabel: "ア",
					isCorrect: true,
					timestamp: 1700000000000,
				}),
			},
			env(),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, answerId: 1 });
	});

	it("POST /answer/submit は不正な questionId で 400", async () => {
		const res = await mountedApp().request(
			"/answer/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: "u1",
					questionId: "bad-id",
					selectedLabel: "ア",
					isCorrect: true,
					timestamp: 1,
				}),
			},
			env(),
		);
		expect(res.status).toBe(400);
	});

	it("GET /answer/history は { answers } を返す", async () => {
		const res = await mountedApp().request("/answer/history?userId=u1", {}, env());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ answers: {} });
	});
});

describe("timer routes", () => {
	it("GET /timer/load は { records, syncedAt } を返す", async () => {
		const res = await mountedApp().request("/timer/load?userId=u1", {}, env());
		expect(res.status).toBe(200);
		const body = (await res.json()) as { records: unknown; syncedAt: number };
		expect(body.records).toEqual({});
		expect(typeof body.syncedAt).toBe("number");
	});

	it("POST /timer/sync は { records, syncedAt } を返す", async () => {
		const res = await mountedApp().request(
			"/timer/sync",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: "u1", records: {} }),
			},
			env(),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { records: unknown; syncedAt: number };
		expect(body.records).toEqual({});
		expect(typeof body.syncedAt).toBe("number");
	});

	it("DELETE /timer/clear は { success: true } を返す", async () => {
		const res = await mountedApp().request(
			"/timer/clear?userId=u1&questionId=exam1-2013-q1",
			{ method: "DELETE" },
			env(),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true });
	});

	it("DELETE /timer/clear は questionId 無しで 400", async () => {
		const res = await mountedApp().request("/timer/clear?userId=u1", { method: "DELETE" }, env());
		expect(res.status).toBe(400);
	});
});

describe("markdown route", () => {
	it("GET /markdown はサイト概要を text/markdown で返す", async () => {
		const res = await mountedApp().request("/markdown", {}, env());
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
		const body = await res.text();
		expect(body.startsWith("# 基本情報技術 I - 明治大学 演習問題サイト")).toBe(true);
	});

	it("GET /markdown/不正パス は 404", async () => {
		const res = await mountedApp().request("/markdown/not-a-unit", {}, env());
		expect(res.status).toBe(404);
	});

	it("GET /markdown/unit-base-conversion/2013 は単元 Markdown を返す", async () => {
		const res = await mountedApp().request("/markdown/unit-base-conversion/2013", {}, env());
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body.startsWith("# ")).toBe(true);
		expect(body).toContain("2013年度");
	});
});

describe("middleware（hono-mw）", () => {
	it("body-limit: 過大な POST ペイロードは 413", async () => {
		const res = await mountedApp().request(
			"/answer/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: "u1",
					questionId: "exam1-2013-q1",
					selectedLabel: "x".repeat(300_000),
					isCorrect: true,
					timestamp: 1,
				}),
			},
			env(),
		);
		expect(res.status).toBe(413);
	});

	it("etag: markdown は ETag を付与し、If-None-Match 一致で 304", async () => {
		const first = await mountedApp().request("/markdown", {}, env());
		const tag = first.headers.get("ETag");
		expect(tag).toBeTruthy();

		const second = await mountedApp().request(
			"/markdown",
			{ headers: { "If-None-Match": tag ?? "" } },
			env(),
		);
		expect(second.status).toBe(304);
	});

	it("request-id: レスポンスに X-Request-Id ヘッダが付く", async () => {
		const res = await mountedApp().request("/answer/status?userId=u1", {}, env());
		expect(res.headers.get("X-Request-Id")).toBeTruthy();
	});

	it("timing: レスポンスに Server-Timing ヘッダが付く", async () => {
		const res = await mountedApp().request("/answer/status?userId=u1", {}, env());
		expect(res.headers.get("Server-Timing")).toBeTruthy();
	});
});
