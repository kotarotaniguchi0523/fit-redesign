import type { Locator, Page } from "playwright/test";

/**
 * 小テストプレイヤー（`/unit-<unit>/<year>/exam/<n>`）の Page Object。
 *
 * サーバー描画（JS なし）では静的なプレビュー（`data-player="preview"`）が出る。
 * 島が hydrate すると操作可能な本体（`data-player="interactive"`）へ置き換わるため、
 * 操作の前には `waitForInteractive()` を挟んでハイドレーション完了を待つ。
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

	/** 島が hydrate した後の操作可能な本体。 */
	get interactive(): Locator {
		return this.page.locator('[data-player="interactive"]');
	}

	/** ハイドレーション完了を待つ（これが通れば島は動作している）。 */
	async waitForInteractive(): Promise<void> {
		await this.interactive.waitFor();
	}

	get revealAnswerButton(): Locator {
		return this.page.getByRole("button", { name: "解答を表示" });
	}

	get answerHeading(): Locator {
		return this.page.getByRole("heading", { name: "解答", exact: true });
	}

	get openQuestionListButton(): Locator {
		return this.page.getByRole("button", { name: "問題一覧を開く" });
	}

	get questionListPanel(): Locator {
		return this.page.getByRole("complementary", { name: "問題一覧" });
	}

	async revealAnswer(): Promise<void> {
		await this.revealAnswerButton.click();
		await this.answerHeading.waitFor();
	}

	async judge(judgment: "correct" | "incorrect"): Promise<void> {
		const label = judgment === "correct" ? "正解として記録" : "不正解として記録";
		await this.page.getByRole("button", { name: label }).click();
	}
}
