/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import todayRoute from "./routes/today/[unit]";

/**
 * 廃止した「今日の道」URLの互換リダイレクトを検証する。
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
	it("既知の単元は最初の年度の小テストへ301リダイレクトする", async () => {
		const res = await mounted().request("/today/unit-base-conversion");
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("/unit-base-conversion/2013");
	});

	it("未知の単元では 404 を返す", async () => {
		const res = await mounted().request("/today/unit-does-not-exist");
		expect(res.status).toBe(404);
	});
});
