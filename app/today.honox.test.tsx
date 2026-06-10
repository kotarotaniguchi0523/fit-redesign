/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import todayRoute from "./routes/today/[unit]";

/**
 * HonoX 版 今日の道ページ（app/routes/today/[unit].tsx）の古典派テスト（AAA）。
 * createRoute のハンドラ配列を、_renderer 相当の軽量レンダラ + spread で /today/:unit にマウントし、
 * ルートが出す DOM（daily-session フック属性・QuestionCard・見出し）と 404 を検証する。
 */
const testRenderer = jsxRenderer(({ children, title }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
		</head>
		<body>{children}</body>
	</html>
));

function mounted(): Hono {
	const app = new Hono();
	app.use("*", testRenderer);
	app.get("/today/:unit", ...todayRoute);
	return app;
}

describe("今日の道ページ 描画", () => {
	it("既知の単元で 200 を返し daily-session の DOM フックを描画する", async () => {
		const res = await mounted().request("/today/unit-base-conversion");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("data-daily-session");
		expect(body).toContain('data-unit-id="unit-base-conversion"');
		expect(body).toContain("session-cards");
		expect(body).toContain("session-next");
		expect(body).toContain("data-question-card");
		expect(body).toContain("今日の道");
	});

	it("未知の単元では 404 を返す", async () => {
		const res = await mounted().request("/today/unit-does-not-exist");
		expect(res.status).toBe(404);
	});
});
