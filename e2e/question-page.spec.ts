import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const FOCUS_ROUTE = /^\/unit-base-conversion\/2013\/exam\?exam=1&question=exam1-2013-q1$/;
const CHATGPT_HREF = /https:\/\/chatgpt\.com\/\?q=/;
const GEMINI_HREF = /^https:\/\/gemini\.google\.com\/app\?q=/;

async function observeAnswerPanelMotion(page: Page): Promise<void> {
	await page.evaluate(() => {
		document.addEventListener("transitionrun", recordMotionStart);
		document.addEventListener("animationstart", recordMotionStart);

		function recordMotionStart(event: Event): void {
			const target = event.target;
			if (target instanceof Element && target.matches(".q-answer-panel, .exam-answer")) {
				document.documentElement.setAttribute("data-test-answer-panel-motion", "started");
			}
		}
	});
}

function isTopmostAtCenter(locator: Locator): Promise<boolean> {
	return locator.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const elementAtCenter = document.elementFromPoint(
			bounds.left + bounds.width / 2,
			bounds.top + bounds.height / 2,
		);
		return (
			elementAtCenter === element || (elementAtCenter !== null && element.contains(elementAtCenter))
		);
	});
}

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

test("一つのコピー操作からMarkdown・ChatGPT・Geminiを選べる", async ({
	page,
	questionSet,
}, testInfo) => {
	await questionSet.open();
	await questionSet.copyButton.click();

	const markdownCopy = questionSet.firstQuestion.getByRole("menuitem", {
		name: "Markdownをコピー",
	});
	const chatGptLink = questionSet.firstQuestion.getByRole("menuitem", { name: "ChatGPTに質問" });
	const geminiLink = questionSet.firstQuestion.getByRole("menuitem", { name: "Geminiに質問" });
	await expect(markdownCopy).toBeVisible();
	await expect(chatGptLink).toHaveAttribute("href", CHATGPT_HREF);
	await expect(chatGptLink).toHaveAttribute("target", "_blank");
	expect(await chatGptLink.evaluate((element) => element.tagName)).toBe("A");
	expect(await isTopmostAtCenter(chatGptLink)).toBe(true);
	await expect(geminiLink).toHaveAttribute("href", GEMINI_HREF);
	await expect(geminiLink).toHaveAttribute("target", "_blank");
	expect(await geminiLink.evaluate((element) => element.tagName)).toBe("A");
	await testInfo.attach("copy-menu-desktop", {
		body: await page.screenshot({ animations: "disabled" }),
		contentType: "image/png",
	});
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await isTopmostAtCenter(chatGptLink)).toBe(true);
	await testInfo.attach("copy-menu-mobile", {
		body: await page.screenshot({ animations: "disabled" }),
		contentType: "image/png",
	});
});

test("解答の開閉がボタンの見た目と内容に反映される", async ({ page, questionSet }, testInfo) => {
	// Arrange
	await questionSet.open();
	await expect(questionSet.answerPanel).toHaveCount(0);
	await observeAnswerPanelMotion(page);
	const closedColor = await questionSet.answerToggle.evaluate(
		(button) => getComputedStyle(button).backgroundColor,
	);

	// Act
	await questionSet.answerToggle.click();

	// Assert
	await expect(questionSet.answerPanel).toBeVisible();
	await expect(questionSet.answerToggle).toHaveAttribute("aria-expanded", "true");
	await expect(page.locator("html")).toHaveAttribute("data-test-answer-panel-motion", "started");
	const openColor = await questionSet.answerToggle.evaluate(
		(button) => getComputedStyle(button).backgroundColor,
	);
	expect(openColor).not.toBe(closedColor);
	await expect(questionSet.question("exam1-2013-q2").locator(".q-answer-panel")).toHaveCount(0);
	await testInfo.attach("answer-open-desktop", {
		body: await questionSet.firstQuestion.screenshot({ animations: "disabled" }),
		contentType: "image/png",
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await testInfo.attach("answer-open-mobile", {
		body: await questionSet.firstQuestion.screenshot({ animations: "disabled" }),
		contentType: "image/png",
	});

	// Act
	await questionSet.firstQuestion.getByRole("button", { name: "解答を隠す" }).click();

	// Assert
	await expect(questionSet.answerPanel).toHaveCount(0);
	await expect(questionSet.answerToggle).toHaveAttribute("aria-expanded", "false");
	await expect
		.poll(() =>
			questionSet.answerToggle.evaluate((button) => getComputedStyle(button).backgroundColor),
		)
		.not.toBe(openColor);

	// 動きを減らす端末設定では内容を即時表示する。
	await page.emulateMedia({ reducedMotion: "reduce" });
	await questionSet.answerToggle.click();
	await expect(questionSet.answerPanel).toHaveCSS("transform", "none");
	await expect(questionSet.answerPanel).toHaveCSS("transition-property", "opacity");
	await expect(questionSet.answerPanel).toHaveCSS("transition-duration", "0.12s");
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
