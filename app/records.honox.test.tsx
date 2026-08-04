/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import dashboard from "./routes/dashboard/index";
import records from "./routes/records";

const renderer = jsxRenderer(({ children, title, noindex }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
			{noindex && <meta name="robots" content="noindex, follow" />}
		</head>
		<body>{children}</body>
	</html>
));

describe("学習記録", () => {
	it("/records は任意機能として描画し noindex にする", async () => {
		const app = new Hono();
		app.use("*", renderer);
		app.get("/records", ...(records as never));
		const response = await app.request("/records");
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("学習記録");
		expect(html).toContain("端末間で同期");
		expect(html).toContain("必要な場合だけ設定します");
		expect(html).toContain('name="robots"');
	});

	it("旧 /dashboard は /records へ301リダイレクトする", async () => {
		const app = new Hono();
		app.get("/dashboard", ...(dashboard as never));
		const response = await app.request("/dashboard");
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/records");
	});
});
