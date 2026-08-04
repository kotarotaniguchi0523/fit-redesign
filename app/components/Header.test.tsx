/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

function renderHeader(path: string): Promise<Response> {
	const app = new Hono();
	app.get("*", (c) => c.html(<Header currentPath={path} />));
	return app.request(path);
}

describe("Header", () => {
	it.each([
		["/", "/", "問題"],
		["/unit-logic/2015", "/", "問題"],
		["/records", "/records", "学習記録"],
		["/slide-only", "/slide-only", "講義資料"],
		["/guide", "/guide", "使い方"],
	])("%s で現在地を一つだけ示す", async (path, href, label) => {
		const html = await (await renderHeader(path)).text();
		expect(html.match(/aria-current="page"/g)).toHaveLength(2);
		expect(html).toContain(`href="${href}" aria-current="page">${label}`);
	});

	it("404や内部プレビューでは問題を現在地にしない", async () => {
		for (const path of ["/missing", "/figures/logic-gates"]) {
			const html = await (await renderHeader(path)).text();
			expect(html).not.toContain('aria-current="page"');
		}
	});
});
