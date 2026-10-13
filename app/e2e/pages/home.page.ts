import type { Locator, Page } from "playwright/test";

/**
 * トップページ（問題を選ぶ）の Page Object。
 *
 * 単元名は見出し・表・アコーディオンの複数箇所に現れるため、操作対象は
 * 「表の行」か「アコーディオン」に限定して引く。狭い画面のアコーディオンは
 * 初期状態が閉じている（`data-state="closed"` で `display: none`）ため、
 * 広い画面では表、狭い画面ではアコーディオンの API を使う。
 */
export class HomePage {
	constructor(private readonly page: Page) {}

	async open(): Promise<void> {
		await this.page.goto("/");
		await this.heading.waitFor();
	}

	get heading(): Locator {
		return this.page.getByRole("heading", { name: "問題を選ぶ" });
	}

	get navigation(): Locator {
		return this.page.getByRole("navigation", { name: "メインナビゲーション" });
	}

	/** 表（広い画面）の単元行。 */
	unitRow(unitName: string): Locator {
		return this.page.getByRole("row").filter({ hasText: unitName }).first();
	}

	/** 単元名がページ上に描画されていることの確認用（リンクではない）。 */
	unitName(unitName: string): Locator {
		return this.page.getByText(unitName).first();
	}

	/** 表（広い画面）の年度リンク。アコーディオンの「2017年度」と区別するため行に限定する。 */
	yearLink(unitName: string, year: string): Locator {
		return this.unitRow(unitName).getByRole("link", { name: year, exact: true }).first();
	}

	/** アコーディオン（狭い画面）の単元ボタン。 */
	accordionTrigger(unitName: string): Locator {
		return this.page.getByRole("button", { name: new RegExp(unitName) }).first();
	}

	/** アコーディオン（狭い画面）を開いた後の年度リンク。 */
	accordionYearLink(year: string): Locator {
		return this.page.getByRole("link", { name: `${year}年度`, exact: true }).first();
	}
}
