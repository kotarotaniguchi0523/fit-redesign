import { expect, type Locator, type Page } from "@playwright/test";

const PLAYER_REGION_NAME = /^(小テストプレイヤー|タイムアタックプレイヤー)$/;

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
	readonly questionResultHeading: Locator;
	readonly totalElapsedTime: Locator;
	readonly questionElapsedTime: Locator;
	readonly saveStatus: Locator;
	readonly questionList: Locator;
	readonly pauseButton: Locator;
	readonly resumeTimerButton: Locator;
	readonly answerPanel: Locator;
	readonly progress: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.player = page.getByRole("region", {
			name: PLAYER_REGION_NAME,
		});
		this.resumeHeading = page.getByRole("heading", { name: "前回の試行をどうしますか？" });
		this.continueButton = page.getByRole("button", { name: "続きから", exact: true });
		this.startOverButton = page.getByRole("button", { name: "最初から", exact: true });
		this.answerToggle = this.player.getByRole("button", { name: "解答を表示", exact: true });
		this.correctButton = this.player.getByRole("button", { name: "正解として記録", exact: true });
		this.previousButton = this.player.getByRole("button", { name: "前の問題", exact: true });
		this.questionListButton = this.player.getByRole("button", {
			name: "問題一覧を開く",
			exact: true,
		});
		this.nextButton = this.player.getByRole("button", { name: "次の問題", exact: true });
		this.resultButton = this.player.getByRole("button", { name: "結果を見る", exact: true });
		this.resultHeading = page.getByRole("heading", { name: "小テストの結果", exact: true });
		this.questionResultHeading = page.getByRole("heading", {
			name: "タイムアタックの結果",
			exact: true,
		});
		this.totalElapsedTime = this.player.getByTestId("challenge-total-time");
		this.questionElapsedTime = this.player.getByTestId("challenge-question-time");
		this.saveStatus = page.getByRole("status");
		this.questionList = page.getByRole("complementary", { name: "問題一覧" });
		this.pauseButton = this.player.getByRole("button", { name: "計測を一時停止", exact: true });
		this.resumeTimerButton = this.player.getByRole("button", { name: "計測を再開", exact: true });
		this.answerPanel = this.player.locator("#exam-answer");
		this.progress = this.player.getByRole("progressbar", { name: "問題の進捗" });
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
		await expect(this.answerPanel).toHaveCount(0);
		await expect(this.answerToggle).toBeVisible();
		await this.answerToggle.click();
		await expect(
			this.player.getByRole("button", { name: "解答を隠す", exact: true }),
		).toBeVisible();
		await expect(this.answerPanel).toBeVisible();
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
		await this.questionList.getByRole("button", { name: "問題一覧を閉じる", exact: true }).click();
		await expect(this.player).toBeVisible();
	}

	async viewResults(): Promise<void> {
		await this.resultButton.click();
		await expect(this.resultHeading).toBeVisible();
	}
}
