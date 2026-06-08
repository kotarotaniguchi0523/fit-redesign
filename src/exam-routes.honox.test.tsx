/** @jsxImportSource hono/jsx */
import { Hono, type MiddlewareHandler } from "hono";
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
 * ## pragma-less 依存コンポーネントのモック（boundary mock）
 * vitest.config.ts は esbuild の jsxImportSource を `hono/jsx/dom` に固定する。
 * `/** @jsxImportSource hono/jsx *​/` プラグマを持つファイル（QuestionCard / 本ルート）は
 * サーバー文字列レンダリング用ランタイムにオーバーライドされるが、プラグマの無いファイル
 * （Header / ExamSection / AnswerSelector / SelfGrade / figures）は dom ランタイムで
 * トランスパイルされ、hono の escapeToBuffer が VNode を文字列化できず TypeError
 * （str.search is not a function）→ 500 になる（本番 honox は vite plugin が各ファイルへ
 * ランタイムを割り当てるためこの問題は起きない。純粋に vitest のトランスパイル都合）。
 *
 * これらの読み取り専用（別オーナー）コンポーネントをモジュール境界で vi.mock し、props を
 * data 属性として出力するスタブに差し替える。これでルートが「何を loader から取得し、
 * 子コンポーネントへどんな props を渡すか」を検証できる。QuestionCard 本体・本ルートは本物。
 *
 * QuestionCard の中身（island への props・解き方パネル等）は今日の道ルートで検証する
 * （今日の道は QuestionCard を直接描画する）。試験ページは ExamSection を介すため、
 * ここでは ExamSection をスタブ化し、ルートが ExamSection へ渡す props を検証する。
 */

// Header（プラグマ無し）→ data 属性スタブ。
vi.mock("../app/components/Header", () => ({
	Header: (props: { currentPath: string }) => <header data-header data-path={props.currentPath} />,
}));

// ExamSection（プラグマ無し）→ title と問題数を出すスタブ。
vi.mock("../app/components/ExamSection", () => ({
	ExamSection: (props: { title: string; exam?: { questions?: unknown[] } }) => (
		<section data-exam-section data-title={props.title}>
			{String(props.exam?.questions?.length ?? 0)}
		</section>
	),
}));

// SlideSection（プラグマ無し）→ スライド数を出すスタブ。
vi.mock("../app/components/SlideSection", () => ({
	SlideSection: (props: { slides: unknown[] }) => (
		<div data-slide-section>{String(props.slides.length)}</div>
	),
}));

// island（プラグマ無し + hooks）→ props を data 属性で出すスタブ。
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

// vi.mock は import より上にホイストされるため、ルート読込前に依存が差し替わる。
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
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: テスト用 JSON-LD 注入
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			) : null}
		</head>
		<body>{children}</body>
	</html>
));

// createRoute の戻り値（ミドルウェア + ハンドラのタプル）を app.get に spread でマウントする。
// 戻り値の正確な型は honox 内部に依存し get のオーバーロード解決と噛み合わないため、
// 実行時に等価な MiddlewareHandler[] として扱う。
function asHandlers(route: unknown): MiddlewareHandler[] {
	return route as MiddlewareHandler[];
}

// NOTE: 未知入力で `c.notFound()` が発火したことの検証は「HTTP ステータス」ではなく
// 「404 ページの本文（ページが見つかりません）が描画されたか」で行う。
// _404.tsx は c.render（c.html 経由）で応答を返し、bare Hono ではハンドラの 200 が勝つため
// この軽量ハーネスでは 404 ステータスにならない（本番 honox の挙動は wrangler 無しでは検証不能）。
// _404.tsx 自体の 404 ステータス付与は本タスクの担当範囲外。

// 試験ページは /:unit/:year、今日の道は /today/:unit にマウントする。
// 404 は本番と同じ _404 ハンドラを app.notFound に登録する（c.render の既定 200 を避ける）。
function mountYearRoute() {
	const app = new Hono();
	app.use("*", testRenderer);
	app.notFound(notFound);
	app.on("GET", "/:unit/:year", asHandlers(yearRoute));
	return app;
}

function mountTodayRoute() {
	const app = new Hono();
	app.use("*", testRenderer);
	app.notFound(notFound);
	app.on("GET", "/today/:unit", asHandlers(todayRoute));
	return app;
}

describe("試験ページ（/[unit]/[year]）", () => {
	it("単一小テストの単元で 200・タイトル・ExamSection・JSON-LD を描画する", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/2013");

		expect(res.status).toBe(200);
		const html = await res.text();
		// loader（getExamByNumber）からデータ取得 → ExamSection へ title が渡る
		expect(html).toContain("data-exam-section");
		expect(html).toContain('data-title="基数変換 (2013)"');
		// unit.title が見出しに出る
		expect(html).toContain("単元1: 基数変換");
		// JSON-LD（Quiz + LearningResource）が props 経由で渡る
		expect(html).toContain('"@type":"Quiz"');
		expect(html).toContain('"@type":"LearningResource"');
		// 単一小テストなので「小テスト一覧」ブロックは出ない
		expect(html).not.toContain("小テスト一覧");
		// integratedTitle が無いので統合試験注意は出ない
		expect(html).not.toContain("統合試験になっています");
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/2013");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("複数小テスト + 統合試験の単元で小テスト一覧・integratedTitle・各 ExamSection を描画する", async () => {
		// unit-logic / 2015: examNumbers [3, 4], integratedTitle "集合・論理演算"
		const res = await mountYearRoute().request("/unit-logic/2015");

		expect(res.status).toBe(200);
		const html = await res.text();
		// 複数小テスト → 小テスト一覧ブロックとアンカー
		expect(html).toContain("小テスト一覧");
		expect(html).toContain("#exam-3");
		expect(html).toContain("#exam-4");
		// 統合試験の注意表示（integratedTitle）
		expect(html).toContain("統合試験になっています");
		expect(html).toContain("集合・論理演算");
		// loader から 2 小テスト分のデータが取得され、それぞれ ExamSection が描画される
		const sectionCount = (html.match(/data-exam-section/g) ?? []).length;
		expect(sectionCount).toBe(2);
	});

	it("未知の単元は notFound ブランチ（404 案内ページ）を返す", async () => {
		const res = await mountYearRoute().request("/unknown-unit/2013");
		const html = await res.text();
		// `c.notFound()` が発火し _404 の案内文が描画される（ステータスは上記 NOTE 参照）
		expect(html).toContain("ページが見つかりません");
		// 単元ページ本文（ExamSection 等）は描画されない
		expect(html).not.toContain("data-exam-section");
	});

	it("未知の年度は notFound ブランチ（404 案内ページ）を返す", async () => {
		const res = await mountYearRoute().request("/unit-base-conversion/1999");
		const html = await res.text();
		expect(html).toContain("ページが見つかりません");
		expect(html).not.toContain("data-exam-section");
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
		expect(html).toContain('data-unit-name="基数変換"');
		expect(html).toContain("data-cards");
		expect(html).toContain("data-progress-bar");
		// QuestionCard（本物）が getUnitQuestions の結果分だけ描画される
		const cardCount = (html.match(/data-question-card/g) ?? []).length;
		expect(cardCount).toBeGreaterThan(0);
		// 解き方パネル（QuestionCard の DOM フック）
		expect(html).toContain("解き方");
		// noindex（旧 Astro の noindex）
		expect(html).toContain('name="robots"');
	});

	it("記述式問題は SelfGrade island へ、選択式問題は AnswerSelector island へ props を渡す", async () => {
		// unit-base-conversion は exam1（全年度）を含み、記述式と選択式の両方を持つ。
		// NOTE: 図表（figureData）を持つ問題の描画は本テストでは未カバー。figures コンポーネントは
		// プラグマ無しのため vitest では string-render で 500 になる（QuestionCard 本体は本物だが
		// figure 経路だけ通せない）。プラグマ追加後に figure 描画の検証を追加できる。
		const res = await mountTodayRoute().request("/today/unit-base-conversion");
		const html = await res.text();
		// 記述式 → SelfGrade に questionId
		expect(html).toContain("data-self-grade");
		// 選択式（exam1-2015-q5 等）→ AnswerSelector に correctLabel / options
		expect(html).toContain("data-answer-selector");
		expect(html).toContain("data-correct-label");
		expect(html).toContain("q-option__label");
	});

	it("エッジキャッシュ用 Cache-Control を付与する", async () => {
		const res = await mountTodayRoute().request("/today/unit-base-conversion");
		expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=31536000, max-age=3600");
	});

	it("未知の単元は notFound ブランチ（404 案内ページ）を返す", async () => {
		const res = await mountTodayRoute().request("/today/unknown-unit");
		const html = await res.text();
		// `c.notFound()` が発火し _404 の案内文が描画される（ステータスは上記 NOTE 参照）
		expect(html).toContain("ページが見つかりません");
		// daily-session 本文は描画されない
		expect(html).not.toContain("data-daily-session");
	});
});
