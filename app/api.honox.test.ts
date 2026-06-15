import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import apiMiddleware from "./routes/_middleware";
import answer from "./routes/answer";
import health from "./routes/health";
import markdown from "./routes/markdown";
import { answers, type Db } from "./server/schema";
import { ensureUserIdentity } from "./server/userIdentity";
import { createTestDb } from "./types/test/d1";

/**
 * 分解した API ファイルルート（app/routes/**）の integration テスト（AAA）。
 *
 * 本番では HonoX が answer.ts（chained Hono sub-app）を /answer へマウントし、
 * _middleware.ts を `subApp.use("*")` で全ルートに適用する。vitest では createApp()
 * （import.meta.glob 依存）が動かないため、同じネスト構造（共通 mw、/markdown に etag）を手で
 * 再現し、外部 URL の HTTP 振る舞い（status・レスポンス形状・400/413/304・middleware ヘッダ）を
 * app.request() で検証する。
 *
 * D1 は実 SQLite（better-sqlite3 + baseline）を c.var.db に直接注入し、answer ルートの
 * 実 SQL（leftJoin / 相関サブクエリ / returning）を本物の DB に対して検証する。
 */

function env(): Cloudflare.Env {
	return {} as unknown as Cloudflare.Env;
}

/** HonoX のネスト sub-app マウントを忠実に再現した合成アプリ。db を c.var へ直接注入する。 */
function mountedApp(db: Db = createTestDb().db): Hono {
	// biome-ignore lint/suspicious/noExplicitAny: テスト用に health ハンドラ配列を spread マウントする
	const spread = (handlers: unknown): any => handlers as any;

	// API は /api プレフィックス無しで root 直下にマウントされる。_middleware は全ルートへ。
	// answer は chained Hono sub-app として /answer に route マウントする。
	const app = new Hono();
	app.use("*", ...spread(apiMiddleware));
	app.use("*", async (c, next) => {
		const identity = ensureUserIdentity(c);
		c.set("userId", identity.userId);
		c.set("userIdCookieIssued", identity.userIdCookieIssued);
		// answer ルートは c.var.db（Drizzle）を使う。server.ts の middleware と同流儀で配線する。
		c.set("db", db);
		await next();
	});
	app.get("/health", ...spread(health));
	app.route("/answer", answer);
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
	it("GET /answer/status は空 DB で空マップを返す", async () => {
		const res = await mountedApp().request("/answer/status", {}, env());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ statuses: {} });
	});

	it("GET /answer/status は userId Cookie が無い場合 middleware が発行する", async () => {
		const res = await mountedApp().request("/answer/status", {}, env());
		expect(res.status).toBe(200);
		expect(res.headers.get("Set-Cookie")).toContain("fit-exam-user-id=");
	});

	it("POST /answer/submit は登録済み question を記録し { ok, answerId } を返す", async () => {
		const { db } = createTestDb();
		const res = await mountedApp(db).request(
			"/answer/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionId: "exam1-2013-q1", selectedLabel: "ア", isCorrect: true }),
			},
			env(),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toMatchObject({ ok: true });
		expect(typeof body.answerId).toBe("number");
		// 実 DB に 1 行記録される。
		expect(await db.select().from(answers)).toHaveLength(1);
	});

	it("POST /answer/submit は body ではなく HttpOnly Cookie の userId で記録する", async () => {
		const { db } = createTestDb();
		const cookieUserId = "550e8400-e29b-41d4-a716-446655440000";
		const res = await mountedApp(db).request(
			"/answer/submit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: `fit-exam-user-id=${cookieUserId}`,
				},
				body: JSON.stringify({ questionId: "exam1-2013-q1", selectedLabel: "ア", isCorrect: true }),
			},
			env(),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Set-Cookie")).toBeNull();
		// 記録された行の user_id は body ではなく Cookie の userId。
		const rows = await db.select().from(answers).where(eq(answers.userId, cookieUserId));
		expect(rows).toHaveLength(1);
	});

	it("POST /answer/submit は余計な userId body を 400 で拒否する（strict schema）", async () => {
		const res = await mountedApp().request(
			"/answer/submit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: "fit-exam-user-id=550e8400-e29b-41d4-a716-446655440000",
				},
				body: JSON.stringify({
					userId: "client-controlled-value",
					questionId: "exam1-2013-q1",
					selectedLabel: "ア",
					isCorrect: true,
				}),
			},
			env(),
		);

		expect(res.status).toBe(400);
	});

	it("POST /answer/submit は不正な questionId で 400", async () => {
		const res = await mountedApp().request(
			"/answer/submit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questionId: "bad-id", selectedLabel: "ア", isCorrect: true }),
			},
			env(),
		);
		expect(res.status).toBe(400);
	});

	it("GET /answer/history は空 DB で空マップを返す", async () => {
		const res = await mountedApp().request("/answer/history", {}, env());
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ answers: {} });
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
		const res = await mountedApp().request("/answer/status", {}, env());
		expect(res.headers.get("X-Request-Id")).toBeTruthy();
	});

	it("timing: レスポンスに Server-Timing ヘッダが付く", async () => {
		const res = await mountedApp().request("/answer/status", {}, env());
		expect(res.headers.get("Server-Timing")).toBeTruthy();
	});
});
