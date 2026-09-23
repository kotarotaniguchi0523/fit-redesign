import { expect, type Locator, type Page } from "@playwright/test";

export class ChallengePlayerPage {
	readonly player: Locator;
	readonly resumeHeading: Locator;
	readonly continueButton: Locator;
	readonly startOverButton: Locator;
	readonly answerToggle: Locator;
	readonly correctButton: Locator;
	readonly previousButton: Locator;
	readonly questionListButton: Locator;
	readonly nextButton: Locator;
	readonly resultButton: Locator;
	readonly resultHeading: Locator;
	readonly saveStatus: Locator;
	readonly questionList: Locator;
	readonly footerButtons: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.player = page.getByRole("region", { name: "小テストプレイヤー" });
		this.resumeHeading = page.getByRole("heading", { name: "前回の試行をどうしますか？" });
		this.continueButton = page.getByRole("button", { name: "続きから", exact: true });
		this.startOverButton = page.getByRole("button", { name: "最初から", exact: true });
		this.answerToggle = this.player.getByText("答えを確認", { exact: true });
		this.correctButton = this.player.getByRole("button", { name: "正解として記録", exact: true });
		this.previousButton = this.player.getByRole("button", { name: "前の問題", exact: true });
		this.questionListButton = this.player.getByRole("button", { name: "問題一覧", exact: true });
		this.nextButton = this.player.getByRole("button", { name: "次の問題", exact: true });
		this.resultButton = this.player.getByRole("button", { name: "結果を見る", exact: true });
		this.resultHeading = page.getByRole("heading", { name: "小テストの結果", exact: true });
		this.saveStatus = page.getByRole("status");
		this.questionList = page.getByRole("region", { name: "問題一覧", exact: true });
		this.footerButtons = this.player.locator(".exam-player__footer .exam-footer-button");
	}

	async openForFreshAttempt(examNumber = 1): Promise<void> {
		await this.page.goto(`/unit-base-conversion/2013/exam?exam=${examNumber}`);
		await expect(this.player.or(this.resumeHeading)).toBeVisible();

		if (await this.resumeHeading.isVisible()) {
			await this.startOverButton.click();
		}

		await expect(this.player).toBeVisible();
		await expect(this.previousButton).toBeVisible();
	}

	async revealAnswer(): Promise<void> {
		await expect(this.answerToggle).toBeVisible();
		await this.answerToggle.click();
		await expect(this.player.getByText("閉じる", { exact: true })).toBeVisible();
	}

	async judgeCorrect(): Promise<void> {
		await this.correctButton.click();
	}

	async reloadToResumePrompt(): Promise<void> {
		await this.page.reload();
		await expect(this.resumeHeading).toBeVisible();
	}

	async continueAttempt(): Promise<void> {
		await this.continueButton.click();
		await expect(this.player).toBeVisible();
	}

	async moveToNextQuestion(): Promise<void> {
		await this.nextButton.click();
	}

	async openQuestionList(): Promise<void> {
		await this.questionListButton.click();
		await expect(this.questionList).toBeVisible();
	}

	async closeQuestionList(): Promise<void> {
		await this.questionList.getByRole("button", { name: "閉じる", exact: true }).click();
		await expect(this.player).toBeVisible();
	}

	async viewResults(): Promise<void> {
		await this.resultButton.click();
		await expect(this.resultHeading).toBeVisible();
	}

	async getFooterButtonWidths(): Promise<number[]> {
		const widths: number[] = [];
		for (let index = 0; index < (await this.footerButtons.count()); index += 1) {
			const bounds = await this.footerButtons.nth(index).boundingBox();
			if (!bounds) {
				throw new Error(`Footer button ${index + 1} is not visible`);
			}
			widths.push(bounds.width);
		}
		return widths;
	}
}
