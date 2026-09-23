import { expect, test } from "./fixtures";

test("小テストの自己判定を保存し、再読み込み後に続きから再開できる", async ({
	challengePlayer,
}) => {
	await challengePlayer.openForFreshAttempt();
	await challengePlayer.revealAnswer();
	await challengePlayer.judgeCorrect();

	await challengePlayer.reloadToResumePrompt();
	await challengePlayer.continueAttempt();
	await challengePlayer.revealAnswer();

	await expect(challengePlayer.correctButton).toBeDisabled();
});

test("localStorageへの保存に失敗しても小テスト結果を表示する", async ({
	page,
	challengePlayer,
}) => {
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
	for (let question = 0; question < 5; question += 1) {
		await challengePlayer.revealAnswer();
		await challengePlayer.judgeCorrect();
		if (question < 4) {
			await challengePlayer.moveToNextQuestion();
		}
	}
	await challengePlayer.viewResults();

	await expect(challengePlayer.saveStatus).toContainText("保存できませんでした");
});

test("スマホ幅の小テストで問題一覧を開閉できる", async ({ page, challengePlayer }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await challengePlayer.openForFreshAttempt();

	await expect(challengePlayer.previousButton).toBeVisible();
	await expect(challengePlayer.previousButton).toBeDisabled();
	await expect(challengePlayer.questionListButton).toBeVisible();
	await expect(challengePlayer.nextButton).toBeVisible();
	const buttonWidths = await challengePlayer.getFooterButtonWidths();

	expect(buttonWidths).toHaveLength(3);
	expect(Math.max(...buttonWidths) - Math.min(...buttonWidths)).toBeLessThan(2);

	await challengePlayer.openQuestionList();
	await expect(challengePlayer.questionList.getByText("全体", { exact: true })).toBeVisible();
	await challengePlayer.closeQuestionList();
});
