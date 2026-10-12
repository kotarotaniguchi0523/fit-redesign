import { defineConfig } from "playwright/test";

/**
 * `remix test` の E2E/browser テストで使う Playwright 設定。
 * テスト自身が `createTestServer(router.fetch)` でサーバーを起動するため、
 * ここではブラウザーの実行条件とタイムアウトのみを設定する。
 */
export default defineConfig({
	testDir: ".",
	fullyParallel: true,
	forbidOnly: true,
	retries: 0,
	reporter: "list",
	timeout: 30_000,
	use: {
		headless: true,
		viewport: { width: 1280, height: 900 },
	},
	projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
