/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, expect, it, vi } from "vitest";

/**
 * 試験ページ（/[unit]/[year]）と今日の道（/today/[unit]）ルートの
 * 古典派 integration テスト（AAA）。
 *
 * static-routes.honox.test.tsx と同じ方針: 本番の honox createApp()（import.meta.glob 依存）と
 * honox/server の Link/Script 解決は vitest で動かないため、_renderer.tsx の prop 契約
 * （title/description/jsonLd/noindex）を再現した軽量レンダラを jsxRenderer で用意し、
 * 各ルートの HTML 出力と渡す props を app.request() で検証する。
 *
 * ## island のモック（boundary mock）
 * QuestionCard は AnswerSelector / SelfGrade island を含む。これらは `hono/jsx` の
 * useActionState / useState / useRef / useEffect を使うが、vitest の esbuild 設定は
 * jsxImportSource を `hono/jsx/dom` に固定するため、SSR 文字列レンダリング時に
 * hono の escapeToBuffer が hook ノードを文字列化できず TypeError（str.search is not a
 * function）で 500 になる。本番（honox）は island を `hono/jsx` で SSR するためこの問題は
 * 起きない（純粋に vitest のトランスパイル都合）。
 *
 * island ファイルは別オーナー（islands エージェント）かつ vitest.config.ts も変更不可のため、
 * モジュール境界で vi.mock してスタブに差し替える。スタブは QuestionCard が island へ渡す
 * props（questionId / correctLabel / options）を data 属性として出力し、props 受け渡しを
 * 検証可能にする。QuestionCard 本体・figures は本物のまま検証する。
 */

vi.mock("../app/islands/AnswerSelector", () => ({
	default: (props: {
		questionId: string;
		correctLabel: string;
		options: { label: string; html: string }[];
	}) => (
		<div
			data-answer-selector
			data-question-id={props.questionId}
			data-correct-label={props.correctLabel}
		>
			{props.options.map((option) => (
				<span class="q-option__label">{option.label}</span>
			))}
		</div>
	),
}));

vi.mock("../app/islands/SelfGrade", () => ({
	default: (props: { questionId: string }) => (
		<div data-self-grade data-question-id={props.questionId} />
	),
}));

// vitest は vi.mock を import より上にホイストするため、QuestionCard 読込前に island が差し替わる。
// static-routes.honox.test.tsx と同じ static import パターンに合わせる（dynamic import + vi.mock は
// ホイスト順がずれてモックが効かない）。
import notFound from "../app/routes/_404";
import yearRoute from "../app/routes/[unit]/[year]";
import todayRoute from "../app/routes/today/[unit]";

const testRenderer = jsxRenderer(({ children, title, description, jsonLd, noindex }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
			{description ? <meta name="description" content={description} /> : null}
			{noindex ? <meta name="robots" content="noindex, follow" /> : null}
			{jsonLd ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: テスト用 JSON-LD 注入
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			) : null}
		</head>
		<body>{children}</body>
	</html>
));

type RouteHandlers = Parameters<Hono["get"]>[1][];

// 試験ページは /:unit/:year、今日の道は /today/:unit にマウントする。
// 404 は本番と同じ _404 ハンドラを app.notFound に登録する（c.render の既定 200 を避ける）。
function mountYearRoute() {
	const app = new Hono();
	app.use("*", testRenderer);
	app.notFound(notFound);
	app.get("/:unit/:year", ...(yearRoute as RouteHandlers));
	return app;
}

function mountTodayRoute() {
	const app = new Hono();
	app.use("*", testRenderer);
	app.notFound(notFound);
	app.get("/today/:unit", ...(todayRoute as RouteHandlers));
	return app;
}

describe("試験ページ（/[unit]/[year]）", () => {
	it("単一小テストの単元で 200・タイトル・問題カード・解き方・JSON-LD を描画する", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/2013");

		expect(res.status).toBe(200);
		const html = await res.text();
		// loader からデータ取得した問題が QuestionCard として描画される
		const cardCount = (html.match(/data-question-card/g) ?? []).length;
		expect(cardCount).toBeGreaterThan(0);
		// unit.title が見出しに出る
		expect(html).toContain("基数変換");
		// 「解き方」パネル（QuestionCard の DOM フック）
		expect(html).toContain("解き方");
		// この単元は記述式（選択肢なし）→ SelfGrade island に props が渡る
		expect(html).toContain("data-self-grade");
		// JSON-LD（Quiz + LearningResource）が props 経由で渡る
		expect(html).toContain('"@type":"Quiz"');
		expect(html).toContain('"@type":"LearningResource"');
		// 単一小テストなので「小テスト一覧」ブロックは出ない
		expect(html).not.toContain("小テスト一覧");
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/2013");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("複数小テスト + 統合試験 + MCQ の単元で小テスト一覧・integratedTitle・AnswerSelector props を描画する", async () => {
		// unit-logic / 2015: examNumbers [3, 4], integratedTitle "集合・論理演算", 選択式問題あり
		const res = await mountYearRoute().request("/unit-logic/2015");

		expect(res.status).toBe(200);
		const html = await res.text();
		// 複数小テスト → 小テスト一覧ブロックとアンカー
		expect(html).toContain("小テスト一覧");
		expect(html).toContain("#exam-3");
		expect(html).toContain("#exam-4");
		// 統合試験の注意表示
		expect(html).toContain("集合・論理演算");
		// MCQ → AnswerSelector island に correctLabel / options が渡る
		expect(html).toContain("data-answer-selector");
		expect(html).toContain("data-correct-label");
		expect(html).toContain("q-option__label");
	});

	it("未知の単元は 404・案内文を返す", async () => {
		const res = await mountYearRoute().request("/unknown-unit/2013");
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain("ページが見つかりません");
	});

	it("未知の年度は 404 を返す", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/1999");
		expect(res.status).toBe(404);
	});
});

describe("今日の道（/today/[unit]）", () => {
	it("200・daily-session DOM・問題カード・noindex を描画する", async () => {
		const res = await mountTodayRoute().request("/today/unit-base-conversion");

		expect(res.status).toBe(200);
		const html = await res.text();
		// daily-session の配線用フック属性
		expect(html).toContain("data-daily-session");
		expect(html).toContain('data-unit-id="unit-base-conversion"');
		expect(html).toContain("data-cards");
		expect(html).toContain("data-progress-bar");
		// 問題カードが描画される（getUnitQuestions の結果）
		const cardCount = (html.match(/data-question-card/g) ?? []).length;
		expect(cardCount).toBeGreaterThan(0);
		// noindex（旧 Astro の noindex）
		expect(html).toContain('name="robots"');
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountTodayRoute().request("/today/unit-base-conversion");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("未知の単元は 404 を返す", async () => {
		const res = await mountTodayRoute().request("/today/unknown-unit");
		expect(res.status).toBe(404);
	});
});
