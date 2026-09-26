import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const DURATION = /^\d{2,}:\d{2}(?::\d{2})?$/;
const QUESTION_ROW = /^問\d+ /;
const FIFTH_QUESTION = /^問5 /;
const MODE_ENTRY_ANIMATION = /^mode-player-enter(?:-reduced)?$/;

async function observeModeEntryAnimation(page: Page): Promise<void> {
	await page.addInitScript(() => {
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

async function expectModeEntryAnimation(page: Page): Promise<void> {
	await expect
		.poll(() => page.locator("html").getAttribute("data-test-mode-entry-animation"))
		.toMatch(MODE_ENTRY_ANIMATION);
}

async function observeAnswerPanelTransition(page: Page): Promise<void> {
	await page.evaluate(() => {
		document.addEventListener("transitionrun", (event) => {
			const target = event.target;
			if (target instanceof Element && target.matches(".q-answer-panel, .exam-answer")) {
				document.documentElement.setAttribute("data-test-answer-panel-transition", "started");
			}
		});
	});
}

test("小テストの判定・経過時間・進捗を再読み込み後も維持する", async ({
	challengePlayer,
	page,
}) => {
	// Arrange
	await page.clock.install();
	await challengePlayer.openForFreshAttempt();
	await expect(challengePlayer.totalElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.questionElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "1");
	await expect(challengePlayer.pauseButton).toHaveAttribute("aria-pressed", "true");
	const initialTime = await challengePlayer.questionElapsedTime.textContent();

	// Act
	await page.clock.runFor(1200);
	await expect(challengePlayer.questionElapsedTime).not.toHaveText(initialTime ?? "");
	await challengePlayer.pauseButton.click();
	await expect(challengePlayer.questionElapsedTime).not.toHaveText(initialTime ?? "");
	const persistedQuestionTime = await challengePlayer.questionElapsedTime.textContent();
	await challengePlayer.revealAnswer();
	await challengePlayer.judgeCorrect();
	await challengePlayer.reloadToResumePrompt();
	await challengePlayer.continueAttempt();
	await expect(challengePlayer.questionElapsedTime).toHaveText(persistedQuestionTime ?? "");
	await page.clock.runFor(1200);
	await expect(challengePlayer.questionElapsedTime).not.toHaveText(persistedQuestionTime ?? "");
	await challengePlayer.revealAnswer();

	// Assert
	await expect(challengePlayer.correctButton).toBeDisabled();
	await expect(challengePlayer.totalElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "1");
});

test("一時停止・再開と前後移動で問題ごとの計測を維持する", async ({ challengePlayer, page }) => {
	// Arrange
	await page.clock.install();
	await challengePlayer.openForFreshAttempt();
	await expect(challengePlayer.pauseButton).toHaveAttribute("aria-pressed", "true");

	// Act
	await challengePlayer.pauseButton.click();
	await expect(challengePlayer.resumeTimerButton).toHaveAttribute("aria-pressed", "false");
	const stopped = await challengePlayer.questionElapsedTime.textContent();
	await page.clock.runFor(1200);

	// Assert
	await expect(challengePlayer.questionElapsedTime).toHaveText(stopped ?? "");

	// Act
	await challengePlayer.resumeTimerButton.click();
	await expect(challengePlayer.pauseButton).toHaveAttribute("aria-pressed", "true");
	await page.clock.runFor(1200);
	await expect(challengePlayer.questionElapsedTime).not.toHaveText(stopped ?? "");
	await challengePlayer.moveToNextQuestion();
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "2");
	await challengePlayer.previousButton.click();

	// Assert
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "1");
	await expect(challengePlayer.questionElapsedTime).not.toHaveText("00:00");
});

test("保存容量不足でも小テストの結果を確認できる", async ({ page, challengePlayer }) => {
	// Arrange
	await page.addInitScript(() => {
		const original = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string): void {
			if (key === "fit-challenge-history-v1") {
				throw new DOMException("quota", "QuotaExceededError");
			}
			original.call(this, key, value);
		};
	});
	await challengePlayer.openForFreshAttempt();

	// Act
	for (let question = 0; question < 5; question += 1) {
		await challengePlayer.revealAnswer();
		await challengePlayer.judgeCorrect();
		if (question < 4) {
			await challengePlayer.moveToNextQuestion();
		}
	}
	await challengePlayer.viewResults();

	// Assert
	await expect(challengePlayer.resultHeading).toBeVisible();
	await expect(challengePlayer.saveStatus).toContainText("保存できませんでした");
});

for (const width of [320, 390]) {
	test(`${width}px で小テストの問題一覧を開閉できる`, async ({ page, challengePlayer }) => {
		// Arrange
		await page.setViewportSize({ width, height: 844 });
		await challengePlayer.openForFreshAttempt();

		// Act
		await challengePlayer.openQuestionList();

		// Assert
		await expect(
			challengePlayer.questionList.getByRole("heading", { name: "問題一覧" }),
		).toBeVisible();
		await expect(
			challengePlayer.questionList.getByRole("button", { name: QUESTION_ROW }),
		).toHaveCount(5);
		expect(
			await page.evaluate(
				() =>
					Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
			),
		).toBeLessThanOrEqual(1);

		// Act
		await challengePlayer.closeQuestionList();

		// Assert
		await expect(challengePlayer.questionList).toHaveCount(0);
		await expect(challengePlayer.player).toBeVisible();
	});
}

test("タイムアタックは選択した一問を計測し、一覧から移動して結果を表示する", async ({
	page,
	challengePlayer,
	questionSet,
}, testInfo) => {
	// Arrange
	await page.setViewportSize({ width: 390, height: 844 });
	await questionSet.open();
	await observeModeEntryAnimation(page);

	// Act
	await questionSet.timerLink.click();

	// Assert
	await expect(challengePlayer.player).toBeVisible();
	await expectModeEntryAnimation(page);
	await expect(challengePlayer.questionElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.totalElapsedTime).toHaveCount(0);
	await expect(challengePlayer.previousButton).toBeDisabled();
	await expect(challengePlayer.pauseButton).toHaveAttribute("aria-pressed", "true");
	await expect(challengePlayer.answerPanel).toHaveCount(0);
	const closedAnswerColor = await challengePlayer.answerToggle.evaluate(
		(button) => getComputedStyle(button).backgroundColor,
	);

	// Act
	await challengePlayer.openQuestionList();
	await challengePlayer.questionList.getByRole("button", { name: FIFTH_QUESTION }).click();

	// Assert
	await expect(
		challengePlayer.player.getByText("13/32(10) を2進数で表せ", { exact: true }),
	).toBeVisible();
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "5");
	await expect(challengePlayer.resultButton).toBeDisabled();

	// Act
	await challengePlayer.previousButton.click();
	await expect(challengePlayer.progress).toHaveAttribute("aria-valuenow", "4");
	await challengePlayer.nextButton.click();
	await observeAnswerPanelTransition(page);
	await challengePlayer.revealAnswer();
	await expect(page.locator("html")).toHaveAttribute(
		"data-test-answer-panel-transition",
		"started",
	);
	expect(
		await challengePlayer.player
			.getByRole("button", { name: "解答を隠す" })
			.evaluate((button) => getComputedStyle(button).backgroundColor),
	).not.toBe(closedAnswerColor);
	await testInfo.attach("time-attack-answer-mobile", {
		body: await page.screenshot({ fullPage: true, animations: "disabled" }),
		contentType: "image/png",
	});
	await challengePlayer.judgeCorrect();

	// Assert
	await expect(challengePlayer.resultButton).toBeEnabled();
	await challengePlayer.resultButton.click();
	await expect(challengePlayer.questionResultHeading).toBeVisible();
	await expect(page.getByText("この問題の結果", { exact: true })).toBeVisible();
});

test("小テストを一覧から開始すると、プレイヤー表示中も計測が進む", async ({
	page,
	questionSet,
	challengePlayer,
}) => {
	// Arrange
	await questionSet.open();
	await observeModeEntryAnimation(page);

	// Act
	await questionSet.startLink.click();

	// Assert
	await expect(challengePlayer.player).toBeVisible();
	await expectModeEntryAnimation(page);
	await expect(challengePlayer.totalElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.questionElapsedTime).toHaveText(DURATION);
	const entryTime = await challengePlayer.questionElapsedTime.textContent();
	await expect
		.poll(() => challengePlayer.questionElapsedTime.textContent(), { timeout: 5000 })
		.not.toBe(entryTime);
});
