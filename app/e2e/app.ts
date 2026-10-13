import type { Page } from "playwright/test";
import type { TestServer } from "remix/node-fetch-server/test";

import { ExamPlayerPage } from "./pages/exam-player.page.ts";
import { HomePage } from "./pages/home.page.ts";
import { UnitYearPage } from "./pages/unit-year.page.ts";
import { createAppServer } from "./server.ts";
import { traceBrowser } from "./support/browser-trace.ts";

/** `remix test` のコンテキスト（`t.serve(...)` だけを使う）。 */
export interface ServeContext {
	serve(server: TestServer): Promise<Page>;
}

export interface Viewport {
	readonly width: number;
	readonly height: number;
}

export const DESKTOP: Viewport = { width: 1280, height: 900 };

/** 1 テストで使うページと Page Object 一式。 */
export interface App {
	readonly page: Page;
	readonly home: HomePage;
	readonly unitYear: UnitYearPage;
	readonly examPlayer: ExamPlayerPage;
}

/**
 * テスト対象のアプリ。テストごとに作り直さず、1 つのサーバーをテスト間で共有して
 * 本番と同じ処理（`app/e2e/server.ts`）を動かし続ける。起動は最初の `serveApp` で遅延して行う。
 */
let sharedServer: TestServer | null = null;

async function appServer(): Promise<TestServer> {
	sharedServer ??= await createAppServer();
	return sharedServer;
}

/** テストスイートの終了時に共有サーバーを閉じる（`afterAll` から呼ぶ）。 */
export async function closeAppServer(): Promise<void> {
	await sharedServer?.close();
	sharedServer = null;
}

/**
 * 共有アプリのページを開き、Page Object 一式を返す。
 * ビューポートは遷移前に固定する（メディアクエリの判定のため）。
 */
export async function serveApp(t: ServeContext, viewport: Viewport = DESKTOP): Promise<App> {
	const server = await appServer();
	// サーバーはテスト間で共有するため、t.serve の後始末では閉じない
	const page = await t.serve({ baseUrl: server.baseUrl, close: async () => {} });
	traceBrowser(page);
	await page.setViewportSize({ width: viewport.width, height: viewport.height });
	return {
		page,
		home: new HomePage(page),
		unitYear: new UnitYearPage(page),
		examPlayer: new ExamPlayerPage(page),
	};
}
