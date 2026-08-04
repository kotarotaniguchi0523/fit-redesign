/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import logicGatesRoute from "./routes/figures/logic-gates";
import logicGatesPngRoute from "./routes/figures/logic-gates.png";
import logicGatesSvgRoute from "./routes/figures/logic-gates.svg";

const testRenderer = jsxRenderer(({ children, title, noindex }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
			{noindex ? <meta name="robots" content="noindex, follow" /> : null}
		</head>
		<body>{children}</body>
	</html>
));

function mounted(): Hono {
	const app = new Hono();
	app.use("*", testRenderer);
	app.get("/figures/logic-gates", ...logicGatesRoute);
	app.get("/figures/logic-gates.svg", ...logicGatesSvgRoute);
	app.get("/figures/logic-gates.png", ...logicGatesPngRoute);
	return app;
}

describe("論理回路図プレビュー", () => {
	it("Hono JSXでAND・OR・NOT・NANDを描画する", async () => {
		const response = await mounted().request("/figures/logic-gates");

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("論理回路図");
		expect(html).toContain("AND");
		expect(html).toContain("OR");
		expect(html).toContain("NOT");
		expect(html).toContain("NAND");
		expect(html).toContain('id="main-content"');
		expect(html).toContain('name="robots"');
		expect(html).toContain('href="/figures/logic-gates.svg"');
	});

	it("Hono JSXからベクターSVGを返す", async () => {
		const response = await mounted().request("/figures/logic-gates.svg");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		const svg = await response.text();
		expect(svg).toMatch(/^<svg /);
		expect(svg).toContain('width="760"');
		expect(svg).toContain('height="260"');
		expect(svg).toContain("<path");
		expect(svg).not.toContain("data:image/svg+xml;base64,");
	});

	it("同じHono JSXをTakumiでPNGへ変換する", async () => {
		const response = await mounted().request("/figures/logic-gates.png");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	});
});
