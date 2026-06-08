import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import todayRoute from "../app/routes/today/[unit]";

/**
 * HonoX 版 今日の道ページ（app/routes/today/[unit].tsx）の古典派テスト（AAA）。
 *
 * 本番では HonoX がファイルパス `app/routes/today/[unit]` を `/today/:unit` にマウントするため、
 * テストでも `parent.route("/today/:unit", todayRoute)` で再現する。
 *
 * 命令的 daily-session は client script が引き継ぐため、ルートは描画済み DOM
 * （data-daily-session 等のフック属性と QuestionCard）を出力するだけ。env / DB は不要。
 */

function mounted() {
	const parent = new Hono();
	parent.route("/today/:unit", todayRoute);
	return parent;
}

describe("今日の道ページ 描画", () => {
	it("既知の単元で 200 を返し daily-session の DOM フックを描画する", async () => {
		const res = await mounted().request("/today/unit-base-conversion");

		expect(res.status).toBe(200);
		const body = await res.text();
		// daily-session の命令的 client script が拾うフック属性
		expect(body).toContain("data-daily-session");
		expect(body).toContain('data-unit-id="unit-base-conversion"');
		expect(body).toContain("data-cards");
		expect(body).toContain("data-progress-bar");
		expect(body).toContain("data-next");
		// 問題カードが描画される
		expect(body).toContain("data-question-card");
		// 見出し
		expect(body).toContain("今日の道");
	});

	it("未知の単元では 404 を返す", async () => {
		const res = await mounted().request("/today/unit-does-not-exist");
		expect(res.status).toBe(404);
	});
});
