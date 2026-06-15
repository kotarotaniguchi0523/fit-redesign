import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AnswerRecord } from "./types/answer";
import { makeAnswerRecord } from "./types/test/answerRecord";

// getUserAnswerHistory を vi.mock で差し替える。本テストは「dashboard ルートの描画」を検証する
// 単位なので、データ源（repository）は意図的にモック注入してビューを分離する。repository の実 SQL
// （leftJoin / 相関サブクエリ / グルーピング）は answerRepository.test.ts の実 DB integration で別途カバー済み。
vi.mock("./server/answerRepository", async (importOriginal) => {
	const original = await importOriginal<typeof import("./server/answerRepository")>();
	return {
		...original,
		getUserAnswerHistory: vi.fn(),
	};
});

import dashboard from "./routes/dashboard/[userId]";
import { getUserAnswerHistory } from "./server/answerRepository";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000" as const;

/**
 * HonoX 版 dashboard 動的ルート（app/routes/dashboard/[userId].tsx）の古典派テスト（AAA）。
 *
 * HonoX は本番でファイルパス `app/routes/dashboard/[userId]` を `/dashboard/:userId` に
 * マウントするため、テストでも `parent.route("/dashboard/:userId", dashboard)` で再現する
 * （c.req.param("userId") が解決される）。redirect 分岐は `:userId` 無しのマウントで再現する。
 *
 * 出力（c.render 経由）は _renderer.tsx が無いため Hono の既定 renderer = c.html() で
 * 本文 JSX のみ描画される。本テストは描画内容（空 / データあり）と redirect 分岐を検証する。
 *
 * getUserAnswerHistory は vi.mock で差し替え済み（ビュー分離。実 SQL は repository の integration で検証）。
 * 渡す Cloudflare.Env は描画に使われないため空でよい。
 */

/** ダッシュボードルートのマウント（userId param が解決される本番相当）。 */
function mountedWithUserId(): Hono {
	const parent = new Hono();
	parent.route("/dashboard/:userId", dashboard);
	return parent;
}

/** ダッシュボードルートのマウント + Cookie userId 変数を c.var に注入。 */
function mountedWithCookieUserId(): Hono {
	const parent = new Hono();
	parent.use("*", async (c, next) => {
		c.set("userId", USER_ID);
		c.set("userIdCookieIssued", false);
		await next();
	});
	parent.route("/dashboard/:userId", dashboard);
	return parent;
}

/** vi.mock 済みの getUserAnswerHistory に返り値を登録するヘルパー。 */
function mockHistory(history: Record<string, AnswerRecord[]>): void {
	vi.mocked(getUserAnswerHistory).mockResolvedValue(history);
}

/** 空の Cloudflare.Env（DB は vi.mock で迂回するため実体不要）。 */
const EMPTY_ENV = {} as unknown as Cloudflare.Env;

// ---------------------------------------------------------------------------
// フィクスチャ: 回答ありユーザーのデータ（with-data）
//
// 設計方針:
//   - 複数の異なる単元に着手し、弱点単元・苦手問題・ヒートマップ・通しタイムが出るデータ
//   - 各 questionId は app/data/units.ts の examMapping に実在するペア
//       exam1-{year} → unit-base-conversion
//       exam2-{year} → unit-negative
//       exam7-{year} → unit-ecc（符号理論）
//   - ヒートマップは today の JST 日付を固定した now を渡し、セルが確実に出るよう前日に回答を置く
//   - 弱点単元: unit-ecc を2問以上着手かつ低スコアにする（不正解 2 回 → masteryRate 低）
//   - 苦手問題: exam7-2013-q1 を 2 回以上不正解にする
//   - 通しタイム: exam1-2013 の q1〜q5 を同じ setId で揃える
// ---------------------------------------------------------------------------

// now を固定（2026-06-12 12:00:00 JST = 2026-06-12 03:00:00 UTC）
// テストを実行した実際の「今日」に依存させないため、aggregateStats に渡す now を制御する。
// ただし dashboard route の loadDashboardData は Date.now() を内部で使うため、
// フィクスチャの created_at はいずれも「数ヶ月前」に置き、todayCount=0 として扱う。
//
// heatmap は "今日" を起点に直近 15 週を展開するため、テスト中の実際の "今日" に
// フィクスチャの created_at が含まれると todayCount が変わりうる。
// ここでは created_at を 2026-04-01 前後に固定し、実行タイミングに依存しない。

/** JST で 2026-04-01 00:00:00（epoch ms）を基準に作る created_at ヘルパー。 */
function jstMs(month: number, day: number, hour = 0): number {
	// UTC で年月日を指定し JST(UTC+9) に換算
	return Date.UTC(2026, month - 1, day, hour - 9, 0, 0);
}

type QuestionId = `exam${number}-${number}-q${number}`;

// 共有ファクトリ makeAnswerRecord に委譲する位置引数ラッパー（フィクスチャの可読性を保つ）。
// 明示 id と固定 createdAt で決定的なフィクスチャを作るため、shared の自動採番 id は上書きする。
function makeRecord(
	id: number,
	questionId: QuestionId,
	isCorrect: boolean,
	createdAt: number,
	duration: number | null = 30,
	setId: string | null = null,
): AnswerRecord {
	return makeAnswerRecord({
		id,
		questionId,
		isCorrect,
		createdAt,
		duration,
		setId,
		selectedLabel: isCorrect ? "ア" : "イ",
		userId: USER_ID as unknown as AnswerRecord["userId"],
	});
}

// exam1-2013 の q1〜q5 を同一セットで揃え、通しタイムが出るようにする（unit-base-conversion）
const SET_ID_BASE = "set-base-0001";
const BASE_CONV_RECORDS: Record<string, AnswerRecord[]> = {
	"exam1-2013-q1": [makeRecord(1, "exam1-2013-q1", true, jstMs(4, 1, 10), 25, SET_ID_BASE)],
	"exam1-2013-q2": [makeRecord(2, "exam1-2013-q2", true, jstMs(4, 1, 10), 30, SET_ID_BASE)],
	"exam1-2013-q3": [makeRecord(3, "exam1-2013-q3", true, jstMs(4, 1, 10), 28, SET_ID_BASE)],
	"exam1-2013-q4": [makeRecord(4, "exam1-2013-q4", false, jstMs(4, 1, 10), 35, SET_ID_BASE)],
	"exam1-2013-q5": [makeRecord(5, "exam1-2013-q5", true, jstMs(4, 1, 10), 22, SET_ID_BASE)],
};

// unit-negative（exam2-2013）: 正解が多め（masteryRate 高）
const NEGATIVE_RECORDS: Record<string, AnswerRecord[]> = {
	"exam2-2013-q1": [
		makeRecord(10, "exam2-2013-q1", true, jstMs(4, 5, 10), 20),
		makeRecord(11, "exam2-2013-q1", true, jstMs(4, 10, 10), 18),
	],
	"exam2-2013-q2": [
		makeRecord(12, "exam2-2013-q2", true, jstMs(4, 6, 11), 22),
		makeRecord(13, "exam2-2013-q2", false, jstMs(4, 11, 11), 15),
	],
	"exam2-2013-q3": [makeRecord(14, "exam2-2013-q3", true, jstMs(4, 7, 10), 25)],
};

// unit-ecc（exam7-2013）: 不正解ばかり → 弱点単元・苦手問題の筆頭
const ECC_RECORDS: Record<string, AnswerRecord[]> = {
	"exam7-2013-q1": [
		// 2 回不正解（苦手問題条件: 2回以上解答・スコア低）、同じ誤答ラベル→trapLabel が出る
		makeRecord(20, "exam7-2013-q1", false, jstMs(4, 8, 10), 20),
		makeRecord(21, "exam7-2013-q1", false, jstMs(4, 12, 10), 18),
	],
	"exam7-2013-q2": [
		makeRecord(22, "exam7-2013-q2", false, jstMs(4, 9, 10), 22),
		makeRecord(23, "exam7-2013-q2", false, jstMs(4, 13, 10), 20),
	],
	"exam7-2013-q3": [makeRecord(24, "exam7-2013-q3", false, jstMs(4, 10, 10), 30)],
};

// with-data フィクスチャ全体
const WITH_DATA_HISTORY: Record<string, AnswerRecord[]> = {
	...BASE_CONV_RECORDS,
	...NEGATIVE_RECORDS,
	...ECC_RECORDS,
};

describe("dashboard 描画", () => {
	it("回答履歴が空のとき empty 状態を描画する", async () => {
		// Arrange: getUserAnswerHistory が空を返す
		mockHistory({});
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, EMPTY_ENV);

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("学習ダッシュボード");
		expect(body).toContain("まだ問題を解いていません");
		// 共有リンクに userId が反映される（末尾スラッシュ無し = trimTrailingSlash 正規化後の形）
		expect(body).toContain(`/dashboard/${USER_ID}`);
	});

	it("DB エラー時も 500 にせず empty 状態にフォールバックする", async () => {
		// Arrange: getUserAnswerHistory が throw する
		vi.mocked(getUserAnswerHistory).mockRejectedValue(new Error("d1 down"));
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, EMPTY_ENV);

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("まだ問題を解いていません");
	});
});

describe("dashboard redirect 分岐", () => {
	it("URL userId が不正なとき Cookie userId の dashboard へリダイレクトする", async () => {
		mockHistory({});
		const res = await mountedWithCookieUserId().request("/dashboard/not-a-uuid", {}, EMPTY_ENV);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`/dashboard/${USER_ID}`);
	});
});

describe("dashboard with-data 描画（①〜⑤ コンポーネント描画アサーション）", () => {
	// 共通: フィクスチャを注入してレンダリングした HTML を共有する
	// vitest の it は独立して動くため、ブロック外で HTML を共有するには beforeAll が必要。
	// 可読性を優先し、各 it で同じリクエストを発行する（lightweight なため問題なし）。

	/** with-data フィクスチャでレンダリングした HTML を返す（ステータス 200 を呼び出し側で検証する）。 */
	async function renderWithData(): Promise<string> {
		mockHistory(WITH_DATA_HISTORY);
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, EMPTY_ENV);
		if (res.status !== 200) {
			throw new Error(`expected 200 but got ${res.status}`);
		}
		return res.text();
	}

	it("① ヒーロー: empty 文言は出ない / 仕上がり% と「着手したN問」が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// Assert: 空状態の文言は出ない
		expect(body).not.toContain("まだ問題を解いていません");

		// 仕上がり率カード: overallMastery が「数値+%」で描画され、直後に「着手したN問の平均スコア」が続くこと。
		// 単に "%" を含むだけだと coverage%・バー幅% にも当たるため、mastery 値の % 単位を直近文脈ごと厳密検証する。
		expect(body).toMatch(/\d+%<\/div>\s*<div[^>]*>着手した\d+問の平均スコア/);

		// 「仕上がり」ラベル
		expect(body).toContain("仕上がり");
	});

	it("① ヒーロー: 今日の演習 SVG リング（aria-label / todayCount/目標問）が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// SVG の aria-label に「今日の演習: N/M問」が含まれる
		expect(body).toContain("今日の演習:");
		// 「今日の演習」ラベル（カード下部）
		expect(body).toContain("今日の演習");
		// SVG リングの transform（"rotate(-90 44 44)"）が存在する
		expect(body).toContain("rotate(-90 44 44)");
		// stroke-dasharray / stroke-dashoffset が描画される（数値は実行時依存のため存在のみ確認）
		expect(body).toContain("stroke-dasharray");
		expect(body).toContain("stroke-dashoffset");
	});

	it("① ヒーロー: カバレッジ%（ N/180問 ）が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// カバレッジカード: N/180問（coverage.total=180 は定数）
		expect(body).toContain("/180問");
		// 「カバレッジ」ラベル
		expect(body).toContain("カバレッジ");
	});

	it("① ヒーロー: 復習の滞留カード（「復習の滞留」ラベルと問数）が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// 滞留カード: 「復習の滞留」ラベル
		expect(body).toContain("復習の滞留");
		// 「N問」の形式（overdueCount は 0 以上の整数）
		expect(body).toMatch(/\d+問/);
	});

	it("② 内訳: 記憶の定着スタックバーが描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// セクション見出し
		expect(body).toContain("仕上がりの内訳");
		// スタックバーの凡例文言
		expect(body).toContain("記憶の定着（間隔反復）");
		expect(body).toContain("定着");
		expect(body).toContain("学習中");
		expect(body).toContain("未学習");
		// Tailwind クラス: スタックバーの色クラス（着手問題があるので定着系の div が出る）
		expect(body).toContain("bg-emerald-700");
		expect(body).toContain("bg-blue-300");
	});

	it("② 内訳: 単元別仕上がり率行（UnitMasteryRow）が単元名と「N/M問着手」で描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// 着手した単元の名前が描画される
		// unit-base-conversion → 「基数変換」
		expect(body).toContain("基数変換");
		// unit-negative → 「負数表現」
		expect(body).toContain("負数表現");
		// unit-ecc → 「符号理論」
		expect(body).toContain("符号理論");

		// 「N/M問着手」の形式（UnitMasteryRow が描画）
		expect(body).toMatch(/\d+\/\d+問着手/);

		// 仕上がり率バーの Tailwind クラス
		expect(body).toContain("bg-emerald-500");
	});

	it("② 内訳: 通しタイムが描画される（exam1-2013 の SET_ID_BASE 完走セット）", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// 前回の通しタイム（formatSetTime 出力: "N分M秒" または "N秒"）
		expect(body).toContain("前回の通しタイム");
		// 2013年度の通しタイム行
		expect(body).toContain("2013");
	});

	it("③ 弱点診断: 弱点単元 Top3 に unit-ecc（符号理論）が出る", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// セクション見出し
		expect(body).toContain("弱点診断");
		expect(body).toContain("弱点単元 Top3");

		// unit-ecc（符号理論）が弱点単元として描画（全問不正解で masteryRate 最低）
		// 「1. 符号理論」が弱点 Top1 に出ることを期待
		expect(body).toContain("符号理論");
		// 弱点単元の masteryRate は低い % として描画（赤色 text-red-600）
		expect(body).toContain("text-red-600");
		// 「解く →」リンクが描画される
		expect(body).toContain("解く →");
	});

	it("③ 弱点診断: 苦手問題 Top5 に exam7-2013-q1 の label が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// 「苦手問題 Top5」見出し
		expect(body).toContain("苦手問題 Top5");

		// exam7-2013-q1 の label は「符号理論 2013 Q1」（questionLabel 形式）
		expect(body).toContain("符号理論 2013 Q1");
		// スコアが赤で描画される（WeaknessPanel の text-red-600）
		// ※ 同クラスは弱点単元でも使うため存在確認のみ（上のアサーションと兼用）
		expect(body).toContain("苦手問題 Top5");
	});

	it("③ 弱点診断: 未着手単元（notStartedUnits）が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// フィクスチャで未着手の単元が多数あるはず（unit-logic 等）
		// WeaknessPanel の「未着手: {単元名}、...」が描画される
		expect(body).toContain("未着手:");
	});

	it("④ 推移グラフ: 粒度トグル（日/週/月 ボタン）と canvas が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// セクション見出し
		expect(body).toContain("正答率の推移");
		expect(body).toContain("回答数の推移");

		// 粒度トグルボタン（data-granularity 属性）
		expect(body).toContain('data-granularity="day"');
		expect(body).toContain('data-granularity="week"');
		expect(body).toContain('data-granularity="month"');
		// ボタンラベル
		expect(body).toContain(">日<");
		expect(body).toContain(">週<");
		expect(body).toContain(">月<");

		// canvas 要素（Chart.js 描画先）
		expect(body).toContain('id="accuracy-trend"');
		expect(body).toContain('id="answer-count"');
	});

	it("⑤ ヒートマップ: 曜日ラベル（月〜日）が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// セクション見出し
		expect(body).toContain("学習ヒートマップ");

		// 曜日ラベル（weekdayLabels = ["月","火","水","木","金","土","日"]）
		// 各ラベルが div 内で描画される
		expect(body).toContain(">月<");
		expect(body).toContain(">火<");
		expect(body).toContain(">水<");
		expect(body).toContain(">木<");
		expect(body).toContain(">金<");
		expect(body).toContain(">土<");
		expect(body).toContain(">日<");
	});

	it("⑤ ヒートマップ: heatmapCellColor 由来の bg-gray-100（0件セル）と bg-emerald-* が描画される", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// 直近15週=105セルは必ず展開されるため bg-gray-100（回答0のセル）が存在する
		expect(body).toContain("bg-gray-100");

		// フィクスチャには 2026-04 に回答があるため、
		// ヒートマップの today（テスト実行日）から15週=105日以内であれば bg-emerald-* も出る。
		// 2026-06-12 から見て 2026-04-01〜2026-04-13 は 105日(≒15週)以内なので bg-emerald-200 が出る。
		expect(body).toContain("bg-emerald-");

		// 凡例（少/多 テキスト）
		expect(body).toContain("少");
		expect(body).toContain("多");
	});

	it("#dashboard-data: 回答ありでは script#dashboard-data が存在する（hasData 最適化の正常系）", async () => {
		// Arrange & Act
		const body = await renderWithData();

		// DashboardDataScript が描画されている
		expect(body).toContain('id="dashboard-data"');
		// application/json 型で chartData が埋め込まれている
		expect(body).toContain('type="application/json"');
		// chartData のキーが含まれる（monthlyStats/dailyStats/weeklyStats）
		expect(body).toContain("monthlyStats");
		expect(body).toContain("dailyStats");
		expect(body).toContain("weeklyStats");
	});

	it("#dashboard-data: 回答なしでは script#dashboard-data が存在しない（hasData=false 最適化）", async () => {
		// Arrange: empty 履歴
		mockHistory({});
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, EMPTY_ENV);

		// Act
		const body = await res.text();

		// Assert: #dashboard-data は出力されない（chart.js を読まない最適化の回帰防止）
		expect(body).not.toContain('id="dashboard-data"');
	});
});
