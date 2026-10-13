import type { Locator, Page } from "playwright/test";

/**
 * 小テストプレイヤー（`/unit-<unit>/<year>/exam/<n>`）の Page Object。
 *
 * サーバー描画では島のプレビュー（`data-player="preview"`）が出る。島の操作は
 * ブラウザーコンポーネントテスト（`*.test.browser.tsx`）が担うため、E2E では
 * 「プレイヤーが描画されたこと」までの確認に留める。
 */
export class ExamPlayerPage {
	constructor(private readonly page: Page) {}

	async open(unitId: string, year: string, examNumber: number): Promise<void> {
		await this.page.goto(`/${unitId}/${year}/exam/${examNumber}`);
	}

	/** プレビュー・本体のどちらでもよい「プレイヤーが描画された」ことの確認用。 */
	get anyPlayer(): Locator {
		return this.page.locator("[data-player]").first();
	}
}
