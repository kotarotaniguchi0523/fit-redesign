import { expect, type Locator, type Page } from "@playwright/test";

const PLAYER_REGION_NAME = /^(小テストプレイヤー|タイムアタックプレイヤー)$/;
const MODE_ENTRY_ANIMATION = /^mode-player-enter(?:-reduced)?$/;

export class ChallengePlayerPage {
	readonly player: Locator;
	readonly resumeHeading: Locator;
	readonly initialQuestionHeading: Locator;
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
	private readonly timerCards: Locator;
	private readonly progressSteps: Locator;
	private readonly progressTrack: Locator;
	readonly questionPrompt: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.player = page.getByRole("region", {
			name: PLAYER_REGION_NAME,
		});
		this.resumeHeading = page.getByRole("heading", { name: "前回の試行をどうしますか？" });
		this.initialQuestionHeading = this.player.getByRole("heading", { name: "問1", exact: true });
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
		this.answerPanel = this.player.getByRole("region", { name: "解答", exact: true });
		this.progress = this.player.getByRole("progressbar", { name: "問題の進捗" });
		this.timerCards = this.player.locator(".exam-player__timers > div");
		this.progressSteps = this.player.locator(".exam-player__progress ol button");
		this.progressTrack = this.player.locator(".exam-player__progress-track");
		this.questionPrompt = this.player.locator(".exam-question__text");
	}

	async openInitialDocument(examNumber = 1): Promise<void> {
		await this.page.goto(`/unit-base-conversion/2013/exam/${examNumber}`);
		await expect(this.player).toBeVisible();
		await expect(this.initialQuestionHeading).toBeVisible();
	}

	async waitUntilReady(): Promise<void> {
		await expect
			.poll(async () => (await this.resumeHeading.isVisible()) || (await this.answerToggle.isVisible()))
			.toBe(true);
	}

	async openForFreshAttempt(examNumber = 1): Promise<void> {
		await this.page.goto(`/unit-base-conversion/2013/exam/${examNumber}`);
		await this.waitUntilReady();

		if (await this.resumeHeading.isVisible()) {
			await this.startOverButton.click();
		}

		await expect(this.previousButton).toBeVisible();
	}

	async observeModeEntryAnimation(): Promise<void> {
		await this.page.addInitScript(() => {
			document.addEventListener("animationstart", (event) => {
				const target = event.target;
				if (
					target instanceof Element &&
					target.matches(".exam-player__question[data-mode-transition-target]")
				) {
					document.documentElement.setAttribute(
						"data-test-mode-entry-animation",
						(event as AnimationEvent).animationName,
					);
				}
			});
		});
	}

	async expectModeEntryAnimation(): Promise<void> {
		await expect
			.poll(() => this.page.locator("html").getAttribute("data-test-mode-entry-animation"))
			.toMatch(MODE_ENTRY_ANIMATION);
	}

	private async waitForAnimationToFinish(locator: Locator): Promise<void> {
		await expect
			.poll(() =>
				locator.evaluate((element) =>
					element.getAnimations().every((animation) => animation.playState === "finished"),
				),
			)
			.toBe(true);
	}

	async getEdgeNavigationCenters(): Promise<{
		previousCenter: number;
		nextCenter: number;
		expectedCenter: number;
	}> {
		await expect(this.previousButton).toBeVisible();
		await expect(this.nextButton).toBeVisible();
		const [previous, next, expectedCenter] = await Promise.all([
			this.previousButton.boundingBox(),
			this.nextButton.boundingBox(),
			this.page.evaluate(() => window.innerHeight * 0.6),
		]);
		if (!(previous && next)) {
			throw new Error("Both question navigation buttons must have layout boxes");
		}
		return {
			previousCenter: previous.y + previous.height / 2,
			nextCenter: next.y + next.height / 2,
			expectedCenter,
		};
	}

	getTimerCardStyles(): Promise<
		Array<{ width: number; height: number; labelSize: string; valueSize: string }>
	> {
		return this.timerCards.evaluateAll((cards) =>
			cards.map((card) => {
				const label = card.querySelector("span");
				const value = card.querySelector("strong");
				if (!(label && value)) {
					throw new Error("Timer label or value is missing");
				}
				const bounds = card.getBoundingClientRect();
				return {
					width: bounds.width,
					height: bounds.height,
					labelSize: getComputedStyle(label).fontSize,
					valueSize: getComputedStyle(value).fontSize,
				};
			}),
		);
	}

	async getActionControlSizes(): Promise<Array<{ width: number; height: number }>> {
		const [answer, pause] = await Promise.all([
			this.answerToggle.boundingBox(),
			this.pauseButton.boundingBox(),
		]);
		if (!(answer && pause)) {
			throw new Error("Answer and timer controls must have layout boxes");
		}
		return [answer, pause].map(({ width, height }) => ({ width, height }));
	}

	async getProgressLayout(): Promise<{
		centers: number[];
		trackStart: number;
		trackEnd: number;
		trackBottom: number;
		promptTop: number;
	}> {
		const [centers, track, prompt] = await Promise.all([
			this.progressSteps.evaluateAll((buttons) =>
				buttons.map((button) => {
					const bounds = button.getBoundingClientRect();
					return bounds.left + bounds.width / 2;
				}),
			),
			this.progressTrack.boundingBox(),
			this.questionPrompt.boundingBox(),
		]);
		if (!(track && prompt)) {
			throw new Error("Progress track and question prompt must have layout boxes");
		}
		return {
			centers,
			trackStart: track.x,
			trackEnd: track.x + track.width,
			trackBottom: track.y + track.height,
			promptTop: prompt.y,
		};
	}

	async getQuestionListLayout(): Promise<{ left: number; width: number; viewportWidth: number }> {
		await expect(this.questionList).toBeVisible();
		await this.waitForAnimationToFinish(this.questionList);
		const [panel, viewportWidth] = await Promise.all([
			this.questionList.boundingBox(),
			this.page.evaluate(() => window.innerWidth),
		]);
		if (!panel) {
			throw new Error("Question list must have a layout box");
		}
		return { left: panel.x, width: panel.width, viewportWidth };
	}

	getHorizontalOverflow(): Promise<number> {
		return this.page.evaluate(
			() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
		);
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
		await this.waitForAnimationToFinish(this.questionList);
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
