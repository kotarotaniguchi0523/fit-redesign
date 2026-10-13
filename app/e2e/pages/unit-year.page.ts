import type { Locator, Page } from "playwright/test";

/**
 * 単元（年度）ページ（`/unit-<unit>/<year>`）の Page Object。
 *
 * 見出しは `h1`（単元名）と `h2`（小テストN: 単元名 (年度)）が同じ語を含むため、
 * 単元見出しは完全一致で引く。
 */
export class UnitYearPage {
	constructor(private readonly page: Page) {}

	async open(unitId: string, year: string): Promise<void> {
		await this.page.goto(`/${unitId}/${year}`);
	}

	heading(unitName: string): Locator {
		return this.page.getByRole("heading", { name: unitName, exact: true });
	}

	/** 小テスト内の単問リンク（`問1` など）。 */
	questionLink(questionNumber: number): Locator {
		return this.page.getByRole("link", { name: `問${questionNumber}`, exact: true }).first();
	}
}
