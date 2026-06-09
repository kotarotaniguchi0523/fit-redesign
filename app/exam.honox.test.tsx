/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import examRoute from "./routes/[unit]/[year]";

/**
 * HonoX 版 単元ページ（app/routes/[unit]/[year].tsx）の古典派テスト（AAA）。
 *
 * 本番では HonoX がファイルパス `app/routes/[unit]/[year]` を `/:unit/:year` にマウントするため、
 * テストでも `parent.route("/:unit/:year", examRoute)` で再現する（c.req.param が解決される）。
 *
 * 試験データは loader（app/data/exams）から取得されるため env や DB は不要。
 * _renderer.tsx は無いため出力は Hono 既定 renderer = c.html() で本文 JSX のみ描画される。
 * JSON-LD（title/jsonLd の props）は _renderer 不在のため本文には現れない点に注意。
 */

const testRenderer = jsxRenderer(({ children, title }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
		</head>
		<body>{children}</body>
	</html>
));

function mounted() {
	const app = new Hono();
	app.use("*", testRenderer);
	app.get("/:unit/:year", ...examRoute);
	return app;
}

describe("単元ページ 描画", () => {
	it("既知の単元・年度で 200 を返し主要コンテンツを描画する", async () => {
		// Act: 基数変換 2013 年度（exam1）
		const res = await mounted().request("/unit-base-conversion/2013");

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		// 単元タイトル・説明・量サマリの見出し
		expect(body).toContain("単元1: 基数変換");
		expect(body).toContain("このページの量");
		// 年度選択 UI
		expect(body).toContain("年度を選択");
		// 問題セクション（QuestionCard の DOM フック）
		expect(body).toContain("data-question-card");
		// 単元タブのリンク
		expect(body).toContain("/unit-negative/2013");
	});

	it("回答 island の props（correctLabel / questionId）が描画される", async () => {
		const res = await mounted().request("/unit-base-conversion/2013");
		const body = await res.text();
		// 選択式問題は AnswerSelector island、記述式は SelfGrade island。
		// どちらかは必ず描画され、問題タイマーのフックも出力される。
		expect(body).toContain("data-question-timer");
		expect(body).toContain("答え合わせをする");
	});

	it("統合試験の年度では integratedTitle の注意が描画される", async () => {
		// 論理演算 2015 年度は「集合・論理演算」統合試験
		const res = await mounted().request("/unit-logic/2015");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("統合試験");
		expect(body).toContain("集合・論理演算");
	});

	it("未知の単元では 404 を返す", async () => {
		const res = await mounted().request("/unit-does-not-exist/2013");
		expect(res.status).toBe(404);
	});

	it("単元に存在しない年度では 404 を返す", async () => {
		// ソート・探索は 2013/2014 のみ。2017 は examMapping に無い。
		const res = await mounted().request("/unit-sort/2017");
		expect(res.status).toBe(404);
	});
});
