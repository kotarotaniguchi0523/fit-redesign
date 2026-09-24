import { expect, test } from "./fixtures";

const FOCUS_ROUTE = /^\/unit-base-conversion\/2013\/exam\?exam=1&question=exam1-2013-q1$/;

test("問題ページの小テスト・PDF・一問ごとの操作が表示される", async ({ questionSet }) => {
	// Arrange
	await questionSet.open();

	// Act
	const timerTarget = await questionSet.timerLink.getAttribute("href");

	// Assert
	await expect(questionSet.pdfLink).toBeVisible();
	await expect(questionSet.startLink).toBeVisible();
	await expect(questionSet.copyButton).toBeVisible();
	await expect(questionSet.answerToggle).toBeVisible();
	expect(timerTarget).toMatch(FOCUS_ROUTE);
});

test("解答は操作した問題だけに表示し、閉じると非表示になる", async ({ questionSet }) => {
	// Arrange
	await questionSet.open();
	await expect(questionSet.answerPanel).toHaveCount(0);

	// Act
	await questionSet.answerToggle.click();

	// Assert
	await expect(questionSet.answerPanel).toBeVisible();
	await expect(questionSet.answerToggle).toHaveAttribute("aria-expanded", "true");
	await expect(questionSet.question("exam1-2013-q2").locator(".q-answer-panel")).toHaveCount(0);

	// Act
	await questionSet.firstQuestion.getByRole("button", { name: "解答を隠す" }).click();

	// Assert
	await expect(questionSet.answerPanel).toHaveCount(0);
});

for (const viewport of [
	{ width: 1365, height: 936 },
	{ width: 390, height: 844 },
	{ width: 320, height: 640 },
]) {
	test(`${viewport.width}px で図付き問題と操作が画面内に収まる`, async ({ page, questionSet }) => {
		// Arrange
		await page.setViewportSize(viewport);

		for (const { path, questionId } of [
			{ path: "/unit-sort/2014", questionId: "exam9-2014-q1" },
			{ path: "/unit-ecc/2016", questionId: "exam7-2016-q1" },
		]) {
			// Act
			await questionSet.open(path);
			const card = questionSet.question(questionId);
			await card.scrollIntoViewIfNeeded();

			// Assert
			await expect(card).toBeVisible();
			await expect(card.locator(".q-figure-wrap")).toBeVisible();
			await expect(card.getByRole("link", { name: "タイムアタック" })).toBeVisible();
			await expect(card.getByRole("button", { name: "解答を表示" })).toBeVisible();
			expect(
				await questionSet.horizontalOverflow(),
				`${path} at ${viewport.width}px`,
			).toBeLessThanOrEqual(1);
		}
	});
}
