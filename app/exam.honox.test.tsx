/** @jsxImportSource hono/jsx */
/** biome-ignore-all lint/nursery/useExplicitReturnType: test app type is intentionally inferred from Hono */
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
		// 単元タイトル・説明
		expect(body).toContain("単元1: 基数変換");
		// 単元・年度は必要なときだけ開くナビゲーションにまとめる
		expect(body).toContain("単元・年度を変更");
		expect(body).toContain('class="study-navigator"');
		// 問題セクション（QuestionCard の DOM フック）
		expect(body).toContain("data-question-card");
		// 単元タブのリンク
		expect(body).toContain("/unit-negative/2013");
	});

	it("入力やタイマーを出さず答え確認とMarkdownコピーを描画する", async () => {
		const res = await mounted().request("/unit-base-conversion/2013");
		const body = await res.text();
		expect(body).toContain("答えを確認する");
		// 解答本文はSSR済みのnative details内に置き、JavaScript失敗時も確認できる。
		expect(body).toContain("<details");
		expect(body).toContain('class="q-solution"');
		expect(body).toContain("Markdownでコピー");
		expect(body).not.toContain("data-question-timer");
		expect(body).not.toContain("答え合わせをする");
	});

	it("複数小テスト年度に小テスト内ジャンプだけを描画する", async () => {
		const res = await mounted().request("/unit-logic/2015");
		const body = await res.text();
		expect(body).toContain("小テスト3 —");
		expect(body).toContain("小テスト4 —");
		expect(body).not.toContain("5問。上から順番でなくても大丈夫です。");
		expect(body).toContain('href="#exam-3"');
		expect(body).toContain('href="#exam-4"');
	});

	it.each([
		["unit-automaton", 6],
		["unit-ecc", 7],
	])("統合試験が別試験を内包する場合は部分集合側を重複表示しない", async (unit, hiddenExam) => {
		const res = await mounted().request(`/${unit}/2016`);
		const body = await res.text();

		expect(res.status).toBe(200);
		expect(body).toContain('id="exam-4"');
		expect(body).not.toContain(`id="exam-${hiddenExam}"`);
		expect(body).not.toContain(`href="#exam-${hiddenExam}"`);
	});

	it("統合試験という重複説明を表示しない", async () => {
		const res = await mounted().request("/unit-logic/2015");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).not.toContain("統合試験です");
		expect(body).not.toContain("小テスト一覧");
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
