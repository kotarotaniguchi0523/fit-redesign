/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./data/site";
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

const testRenderer = jsxRenderer(({ children, title, canonical }) => {
	const requestContext = useRequestContext();
	// canonical override（?exam 等のクエリを含む正規 URL）。未指定なら従来どおり path から生成。
	const canonicalHref = new URL(canonical ?? requestContext.req.path, SITE_URL).href;
	return (
		<html lang="ja">
			<head>
				<title>{title}</title>
				<link rel="canonical" href={canonicalHref} />
			</head>
			<body>{children}</body>
		</html>
	);
});

function mounted(): Hono {
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
		// ラップ式ストップウォッチ island がマウントされる（duration/set_id 計測の起点）
		expect(body).toContain("data-lap-stopwatch");
	});

	it("回答 island の props（correctLabel / questionId）が描画される", async () => {
		const res = await mounted().request("/unit-base-conversion/2013");
		const body = await res.text();
		// 選択式問題は AnswerSelector island、記述式は SelfGrade island。
		// どちらかは必ず描画される（タイマーはカード外のページ単位 island へ移行したのでここでは検証しない）。
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

	it("有効な ?exam クエリで指定した小テストのみ描画される", async () => {
		// 集合・確率（unit-set-prob）2013 年度は examNumbers: [5, 6] の複数 exam
		const res = await mounted().request("/unit-set-prob/2013?exam=6");
		expect(res.status).toBe(200);
		const body = await res.text();
		// exam6 の問題 ID が含まれること
		expect(body).toContain("exam6-2013");
		// 小テスト切替タブが出ること
		expect(body).toContain("小テストを選択");
		// 選択中 exam6 のタブが aria-selected=true
		expect(body).toContain('aria-selected="true"');
	});

	it("無効な ?exam クエリは先頭 exam にフォールバックし 200 を返す", async () => {
		// exam=999 は存在しない → 先頭 examNumbers[0]（=5）にフォールバック
		const res = await mounted().request("/unit-set-prob/2013?exam=999");
		expect(res.status).toBe(200);
		const body = await res.text();
		// フォールバック先 exam5 の問題 ID が含まれること
		expect(body).toContain("exam5-2013");
	});

	it("単一 exam の年度では小テスト切替タブを描画しない", async () => {
		// 基数変換 2013 は examNumbers: [1] の単一 exam
		const res = await mounted().request("/unit-base-conversion/2013");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).not.toContain("小テストを選択");
	});
});

describe("表示時 dedup（二重表示解消）", () => {
	it("unit-automaton/2016: 統合 exam4 の問題IDが描画され「小テストを選択」タブが出ない（単一化）", async () => {
		// 2016 年度 unit-automaton の examNumbers=[4,6]。exam4 が exam6 を内包するため visibleExamNumbers=[4]。
		const res = await mounted().request("/unit-automaton/2016");
		expect(res.status).toBe(200);
		const body = await res.text();
		// exam4-2016 は exam6-2016-q1..5 と exam7-2016-q1..5 を含むため問題IDが出ること
		expect(body).toContain("exam6-2016-q1");
		expect(body).toContain("exam7-2016-q1");
		// visibleExamNumbers=[4] で単一化されているのでタブは出ない
		expect(body).not.toContain("小テストを選択");
	});

	it("unit-ecc/2016: 統合 exam4 のみ表示・exam7 のタブが出ない", async () => {
		// 2016 年度 unit-ecc の examNumbers=[4,7]。exam4⊇exam7 なので visibleExamNumbers=[4]。
		const res = await mounted().request("/unit-ecc/2016");
		expect(res.status).toBe(200);
		const body = await res.text();
		// exam4-2016 は exam7-2016 の問題を含む
		expect(body).toContain("exam7-2016-q1");
		// タブが出ない（単一化）
		expect(body).not.toContain("小テストを選択");
	});

	it("unit-data-structure/2016: exam5==exam8 で exam5 のみ残る（タブなし）", async () => {
		// 2016 年度 unit-data-structure の examNumbers=[5,8]。完全一致で番号小さい exam5 を残す。
		const res = await mounted().request("/unit-data-structure/2016");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("exam8-2016-q1");
		expect(body).not.toContain("小テストを選択");
	});

	it("unit-data-structure/2017: exam5,exam6 のタブが出て exam8 の単独タブが出ない", async () => {
		// 2017 年度 unit-data-structure の examNumbers=[5,6,8]。exam5⊇exam8 で exam8 除外 → visibleExamNumbers=[5,6]。
		const res = await mounted().request("/unit-data-structure/2017");
		expect(res.status).toBe(200);
		const body = await res.text();
		// 複数 visible exam があるのでタブが出ること
		expect(body).toContain("小テストを選択");
		// exam5 タブが存在すること（href に ?exam=5）
		expect(body).toContain("?exam=5");
		// exam6 タブが存在すること（href に ?exam=6）
		expect(body).toContain("?exam=6");
		// exam8 タブは dedup で除外されているので出ない
		expect(body).not.toContain("?exam=8");
	});

	it("unit-automaton/2016?exam=6（dedup で消えた番号）→ 先頭 visible(exam4) にフォールバック", async () => {
		// ?exam=6 は visibleExamNumbers=[4] に含まれないため resolveSelectedExamNumber が先頭の 4 を返す。
		const res = await mounted().request("/unit-automaton/2016?exam=6");
		expect(res.status).toBe(200);
		const body = await res.text();
		// フォールバック先 exam4 の問題IDが描画されること
		expect(body).toContain("exam6-2016-q1");
	});

	it("unit-set-prob/2013: 互いに素な examNumbers=[5,6] は変更なく両タブが出る", async () => {
		// dedup の影響を受けない既存ケースの確認
		const res = await mounted().request("/unit-set-prob/2013?exam=6");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("exam6-2013");
		expect(body).toContain("小テストを選択");
	});
});

describe("canonical self-referencing", () => {
	it("複数 exam 年度の ?exam=6 は canonical に ?exam=6 が付く", async () => {
		// 集合・確率（unit-set-prob）2013 年度は examNumbers: [5, 6] の複数 exam
		const res = await mounted().request("/unit-set-prob/2013?exam=6");
		expect(res.status).toBe(200);
		const body = await res.text();
		// canonical link 自体の href が ?exam=6 を含むこと（exam タブの href ではなく canonical を厳密検証）
		expect(body).toMatch(/<link rel="canonical" href="[^"]*\/unit-set-prob\/2013\?exam=6"/);
	});

	it("単一 exam 年度の canonical は ?exam クエリを含まない", async () => {
		// 基数変換 2013 は examNumbers: [1] の単一 exam
		const res = await mounted().request("/unit-base-conversion/2013");
		expect(res.status).toBe(200);
		const body = await res.text();
		// canonical link 自体が ?exam クエリ無しの URL で終わること（href の閉じ引用符直前が /2013）
		expect(body).toMatch(/<link rel="canonical" href="[^"]*\/unit-base-conversion\/2013"/);
		expect(body).not.toMatch(/<link rel="canonical" href="[^"]*\?exam/);
	});

	it("無効な ?exam クエリは先頭 exam=5 にフォールバックし canonical は ?exam=5 になる", async () => {
		// exam=999 は存在しない → resolveSelectedExamNumber が先頭 examNumbers[0]=5 を返す
		const res = await mounted().request("/unit-set-prob/2013?exam=999");
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toMatch(/<link rel="canonical" href="[^"]*\/unit-set-prob\/2013\?exam=5"/);
	});
});
