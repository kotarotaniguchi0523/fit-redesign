import { expect, test } from "./fixtures";
import { expectAnswerPanelMotion, observeAnswerPanelMotion } from "./helpers/answer-panel-motion";

const DURATION = /^\d{2,}:\d{2}(?::\d{2})?$/;
const QUESTION_ROW = /^問\d+ /;
const FIFTH_QUESTION = /^問5 /;
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
		const edgeNavigationPositions = await challengePlayer.player.evaluate((player) => {
			const workspace = player.querySelector<HTMLElement>(".exam-player__workspace");
			const previous = player.querySelector<HTMLElement>(".exam-player__edge-nav-button--previous");
			const next = player.querySelector<HTMLElement>(".exam-player__edge-nav-button--next");
			if (!(workspace && previous && next)) {
				throw new Error("Both edge navigation buttons and their workspace must be present");
			}
			const workspaceBounds = workspace.getBoundingClientRect();
			const previousBounds = previous.getBoundingClientRect();
			const nextBounds = next.getBoundingClientRect();
			return {
				previousCenter: previousBounds.top + previousBounds.height / 2,
				nextCenter: nextBounds.top + nextBounds.height / 2,
				expectedCenter: window.innerHeight * 0.6,
			};
		});
		expect(
			Math.abs(edgeNavigationPositions.previousCenter - edgeNavigationPositions.nextCenter),
		).toBeLessThan(1);
		expect(
			Math.abs(edgeNavigationPositions.previousCenter - edgeNavigationPositions.expectedCenter),
		).toBeLessThan(1);
		const timerCards = await challengePlayer.player.evaluate((player) =>
			Array.from(player.querySelectorAll<HTMLElement>(".exam-player__timers > div")).map((card) => {
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
		expect(timerCards).toHaveLength(2);
		expect(Math.abs(timerCards[0].width - timerCards[1].width)).toBeLessThan(1);
		expect(Math.abs(timerCards[0].height - timerCards[1].height)).toBeLessThan(1);
		expect(timerCards[0].labelSize).toBe(timerCards[1].labelSize);
		expect(timerCards[0].valueSize).toBe(timerCards[1].valueSize);

		// Act
		await challengePlayer.openQuestionList();

		// Assert
		await expect(
			challengePlayer.questionList.getByRole("heading", { name: "問題一覧" }),
		).toBeVisible();
		const questionListBounds = await challengePlayer.questionList.evaluate((list) => {
			const { left, width: panelWidth } = list.getBoundingClientRect();
			return { left, panelWidth, viewportWidth: window.innerWidth };
		});
		expect(questionListBounds.left).toBe(0);
		expect(questionListBounds.panelWidth).toBeLessThan(questionListBounds.viewportWidth * 0.85);
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
	await challengePlayer.observeModeEntryAnimation();

	// Act
	await questionSet.startTimeAttack();

	// Assert
	await expect(challengePlayer.player).toBeVisible();
	await challengePlayer.expectModeEntryAnimation();
	await expect(challengePlayer.questionElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.totalElapsedTime).toHaveCount(0);
	await expect(challengePlayer.player.getByText("1 / 5", { exact: true })).toHaveCount(0);
	const actionButtonSizes = await Promise.all([
		challengePlayer.answerToggle.evaluate((button) => {
			const { width, height } = button.getBoundingClientRect();
			return { width, height };
		}),
		challengePlayer.pauseButton.evaluate((button) => {
			const { width, height } = button.getBoundingClientRect();
			return { width, height };
		}),
	]);
	expect(Math.abs(actionButtonSizes[0].width - actionButtonSizes[1].width)).toBeLessThan(1);
	expect(Math.abs(actionButtonSizes[0].height - actionButtonSizes[1].height)).toBeLessThan(1);
	const progressLayout = await challengePlayer.player.evaluate((player) => {
		const buttons = Array.from(
			player.querySelectorAll<HTMLElement>(".exam-player__progress ol button"),
		);
		const track = player.querySelector<HTMLElement>(".exam-player__progress-track");
		if (!track) {
			throw new Error("Question progress track is missing");
		}
		const trackBounds = track.getBoundingClientRect();
		return {
			centers: buttons.map((button) => {
				const bounds = button.getBoundingClientRect();
				return bounds.left + bounds.width / 2;
			}),
			trackStart: trackBounds.left,
			trackEnd: trackBounds.right,
			trackBottom: trackBounds.bottom,
			promptTop: (() => {
				const prompt = player.querySelector<HTMLElement>(".exam-question__text");
				if (!prompt) {
					throw new Error("Question prompt is missing");
				}
				return prompt.getBoundingClientRect().top;
			})(),
		};
	});
	expect(progressLayout.centers).toHaveLength(5);
	expect(Math.abs(progressLayout.centers[0] - progressLayout.trackStart)).toBeLessThan(1);
	const lastCenter = progressLayout.centers.at(-1);
	if (lastCenter === undefined) {
		throw new Error("Question progress steps are missing");
	}
	expect(Math.abs(lastCenter - progressLayout.trackEnd)).toBeLessThan(1);
	const stepDistances = progressLayout.centers
		.slice(1)
		.map((center, index) => center - progressLayout.centers[index]);
	for (const distance of stepDistances.slice(1)) {
		expect(Math.abs(distance - stepDistances[0])).toBeLessThan(1);
	}
	expect(progressLayout.promptTop).toBeGreaterThan(progressLayout.trackBottom);
	expect(progressLayout.promptTop - progressLayout.trackBottom).toBeLessThan(100);
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
	await observeAnswerPanelMotion(page);
	await challengePlayer.revealAnswer();
	await expectAnswerPanelMotion(page);
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
	questionSet,
	challengePlayer,
}) => {
	// Arrange
	await questionSet.open();
	await challengePlayer.observeModeEntryAnimation();

	// Act
	await questionSet.startExam();

	// Assert
	await expect(challengePlayer.player).toBeVisible();
	await challengePlayer.expectModeEntryAnimation();
	await expect(challengePlayer.totalElapsedTime).toHaveText(DURATION);
	await expect(challengePlayer.questionElapsedTime).toHaveText(DURATION);
	const entryTime = await challengePlayer.questionElapsedTime.textContent();
	await expect
		.poll(() => challengePlayer.questionElapsedTime.textContent(), { timeout: 5000 })
		.not.toBe(entryTime);
});
