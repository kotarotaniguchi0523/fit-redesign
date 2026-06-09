import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import dashboard from "./routes/dashboard/[userId]";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";

/**
 * HonoX 版 dashboard 動的ルート（app/routes/dashboard/[userId].tsx）の古典派テスト（AAA）。
 *
 * HonoX は本番でファイルパス `app/routes/dashboard/[userId]` を `/dashboard/:userId` に
 * マウントするため、テストでも `parent.route("/dashboard/:userId", dashboard)` で再現する
 * （c.req.param("userId") が解決される）。redirect 分岐は `:userId` 無しのマウントで再現する。
 *
 * 出力（c.render 経由）は _renderer.tsx が無いため Hono の既定 renderer = c.html() で
 * 本文 JSX のみ描画される。本テストは描画内容（空 / データあり）と redirect 分岐を検証する。
 */

interface FakeAnswerRow {
	id: number;
	user_id: string;
	question_id: string;
	selected_label: string;
	is_correct: number;
	duration: number | null;
	timestamp: number;
	created_at: number;
}

/** 指定の answers 行を `.all()` で返す fake D1。 */
function makeFakeDb(rows: FakeAnswerRow[]): D1Database {
	const stmt = {
		bind: (): typeof stmt => stmt,
		all: (): Promise<{ results: FakeAnswerRow[] }> => Promise.resolve({ results: rows }),
		run: (): Promise<{ meta: { last_row_id: number }; success: boolean }> =>
			Promise.resolve({ meta: { last_row_id: 1 }, success: true }),
		first: (): Promise<null> => Promise.resolve(null),
	};
	return {
		prepare: () => stmt,
		batch: (stmts: unknown[]) => Promise.resolve(stmts.map(() => ({ results: [], success: true }))),
	} as unknown as D1Database;
}

function env(rows: FakeAnswerRow[]): Cloudflare.Env {
	return { DB: makeFakeDb(rows), CACHE: {} } as unknown as Cloudflare.Env;
}

/** `/dashboard/:userId` マウント（userId が解決される本番相当）。 */
function mountedWithUserId(): Hono {
	const parent = new Hono();
	parent.route("/dashboard/:userId", dashboard);
	return parent;
}

/** `/dashboard/:userId` マウント + Cookie userId 変数。 */
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

describe("dashboard 描画", () => {
	it("回答履歴が空のとき empty 状態を描画する", async () => {
		// Arrange: D1 が空配列を返す
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, env([]));

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("学習ダッシュボード");
		expect(body).toContain("まだ問題を解いていません");
		// 共有リンクに userId が反映される（末尾スラッシュ無し = trimTrailingSlash 正規化後の形）
		expect(body).toContain(`/dashboard/${USER_ID}`);
	});

	// TODO(T12): getUserAnswerHistory が Drizzle 化されたため、prepare().bind().all() を模した
	// fake-D1 では leftJoin が DrizzleQueryError になり empty へフォールバックする。実 D1 ハーネスへ移行する。
	it.skip("回答履歴があるとき集計サマリーを描画する", async () => {
		// Arrange: exam1-2013-q1 に正解 1 件
		const rows: FakeAnswerRow[] = [
			{
				id: 1,
				user_id: USER_ID,
				question_id: "exam1-2013-q1",
				selected_label: "ア",
				is_correct: 1,
				duration: 30,
				timestamp: 1_700_000_000_000,
				created_at: 1_700_000_000_000,
			},
		];
		const res = await mountedWithUserId().request(`/dashboard/${USER_ID}`, {}, env(rows));

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("解いた問題数");
		expect(body).toContain("正答率");
		// empty 状態の文言は出ない
		expect(body).not.toContain("まだ問題を解いていません");
	});

	it("DB エラー時も 500 にせず empty 状態にフォールバックする", async () => {
		// Arrange: prepare で throw する壊れた DB
		const brokenDb = {
			prepare: () => {
				throw new Error("d1 down");
			},
		} as unknown as D1Database;
		const brokenEnv = { DB: brokenDb, CACHE: {} } as unknown as Cloudflare.Env;
		const parent = new Hono();
		parent.route("/dashboard/:userId", dashboard);

		// Act
		const res = await parent.request(`/dashboard/${USER_ID}`, {}, brokenEnv);

		// Assert
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain("まだ問題を解いていません");
	});
});

describe("dashboard redirect 分岐", () => {
	it("URL userId が不正なとき Cookie userId の dashboard へリダイレクトする", async () => {
		const res = await mountedWithCookieUserId().request("/dashboard/not-a-uuid", {}, env([]));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`/dashboard/${USER_ID}`);
	});
});
