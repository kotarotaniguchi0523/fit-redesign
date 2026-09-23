import { expect, test } from "@playwright/test";

test("quiz records a self-judgment and resumes after reload", async ({ page }) => {
	await page.goto("/unit-base-conversion/2013/exam?exam=1");
	await expect(page.getByRole("heading", { name: /小テスト/ })).toBeVisible();
	await page.getByText("答えを確認", { exact: true }).click();
	await expect(page.getByText("閉じる", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "正解として記録", exact: true }).click();
	await page.reload();
	await expect(page.getByText("続きから", { exact: true })).toBeVisible();
	await page.getByText("続きから", { exact: true }).click();
	await page.getByText("答えを確認", { exact: true }).click();
	await expect(page.getByRole("button", { name: "正解として記録", exact: true })).toBeDisabled();
});

test("results remain available when browser storage writes fail", async ({ page }) => {
	await page.addInitScript(() => {
		const original = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string): void {
			if (key === "fit-challenge-history-v1") throw new DOMException("quota", "QuotaExceededError");
			original.call(this, key, value);
		};
	});
	await page.goto("/unit-base-conversion/2013/exam?exam=1");
	for (let question = 0; question < 5; question += 1) {
		await page.getByText("答えを確認", { exact: true }).click();
		await page.getByRole("button", { name: "正解として記録", exact: true }).click();
		if (question < 4) await page.getByRole("button", { name: "次の問題" }).click();
	}
	await page.getByRole("button", { name: "結果を見る" }).click();
	await expect(page.getByRole("heading", { name: "小テストの結果" })).toBeVisible();
	await expect(page.getByRole("status")).toContainText("保存できませんでした");
});

test("mobile challenge controls stay compact and the question list can be closed", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/unit-base-conversion/2013/exam?exam=1");
	const previous = page.getByRole("button", { name: "前の問題" });
	const index = page.getByRole("button", { name: "問題一覧" });
	const next = page.getByRole("button", { name: "次の問題" });
	await expect(previous).toBeVisible();
	await expect(index).toBeVisible();
	await expect(next).toBeVisible();

	const layout = await page.evaluate(() => ({
		viewportWidth: window.innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
		buttonWidths: Array.from(
			document.querySelectorAll<HTMLElement>(".exam-player__footer .exam-footer-button"),
			(button) => button.getBoundingClientRect().width,
		),
	}));
	expect(layout.scrollWidth).toBe(layout.viewportWidth);
	expect(layout.buttonWidths).toHaveLength(3);
	expect(Math.max(...layout.buttonWidths) - Math.min(...layout.buttonWidths)).toBeLessThan(2);

	await index.click();
	await expect(page.getByRole("region", { name: "問題一覧" })).toBeVisible();
	await expect(page.getByText("全体", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "閉じる" }).click();
	await expect(page.getByRole("region", { name: "小テストプレイヤー" })).toBeVisible();
});

test("question page actions stay compact on desktop and mobile", async ({ page }) => {
	await page.setViewportSize({ width: 1365, height: 936 });
	await page.goto("/unit-base-conversion/2013");

	const layout = await page.evaluate(() => {
		const container = document.querySelector<HTMLElement>(
			".study-shell--question-set .page-container--wide",
		);
		const card = document.querySelector<HTMLElement>(".study-shell--question-set .q-card");
		const answer = document.querySelector<HTMLElement>(".study-shell--question-set .q-btn-primary");
		const prompt = document.querySelector<HTMLElement>(".study-shell--question-set .q-prompt");
		const actions = document.querySelector<HTMLElement>(".study-shell--question-set .q-card__actions");
		const copy = actions?.querySelector<HTMLElement>(".q-tool");
		const timer = actions?.querySelector<HTMLElement>(".question-timer-link");
		if (!container || !card || !answer || !prompt || !actions || !copy || !timer) {
			throw new Error("Question layout elements are missing");
		}
		const cardBounds = card.getBoundingClientRect();
		const containerBounds = container.getBoundingClientRect();
		const promptBounds = prompt.getBoundingClientRect();
		const actionsBounds = actions.getBoundingClientRect();
		const copyBounds = copy.getBoundingClientRect();
		const timerBounds = timer.getBoundingClientRect();
		return {
			containerWidth: containerBounds.width,
			containerCenterError: Math.abs(
				containerBounds.left + containerBounds.width / 2 - window.innerWidth / 2,
			),
			answerWidth: answer.getBoundingClientRect().width,
			controlsOnRight: promptBounds.right <= actionsBounds.left,
			controlsWidth: actionsBounds.width,
			copyAboveTimer: copyBounds.top < timerBounds.top,
			controlGap: timerBounds.top - copyBounds.bottom,
			cardCenter: cardBounds.left + cardBounds.width / 2,
		};
	});

	await expect(page.getByRole("button", { name: "Copy", exact: true }).first()).toBeVisible();
	await expect(page.getByRole("link", { name: "時間を測る", exact: true }).first()).toBeVisible();
	expect(layout.containerWidth).toBeLessThanOrEqual(832);
	expect(layout.containerCenterError).toBeLessThan(1);
	expect(layout.answerWidth).toBeLessThanOrEqual(240);
	expect(layout.controlsOnRight).toBe(true);
	expect(layout.controlsWidth).toBeLessThanOrEqual(128);
	expect(layout.copyAboveTimer).toBe(true);
	expect(Math.abs(layout.controlGap)).toBeLessThan(1);

	await page.setViewportSize({ width: 390, height: 844 });
	const mobileLayout = await page.evaluate(() => {
		const prompt = document.querySelector<HTMLElement>(".study-shell--question-set .q-prompt");
		const actions = document.querySelector<HTMLElement>(".study-shell--question-set .q-card__actions");
		const copy = actions?.querySelector<HTMLElement>(".q-tool");
		const timer = actions?.querySelector<HTMLElement>(".question-timer-link");
		if (!prompt || !actions || !copy || !timer) {
			throw new Error("Mobile question actions are missing");
		}
		const promptBounds = prompt.getBoundingClientRect();
		const actionsBounds = actions.getBoundingClientRect();
		const copyBounds = copy.getBoundingClientRect();
		const timerBounds = timer.getBoundingClientRect();
		return {
			viewportWidth: window.innerWidth,
			scrollWidth: document.documentElement.scrollWidth,
			actionsBelowPrompt: actionsBounds.top >= promptBounds.bottom,
			actionsWidth: actionsBounds.width,
			controlGap: timerBounds.top - copyBounds.bottom,
		};
	});

	expect(mobileLayout.scrollWidth).toBe(mobileLayout.viewportWidth);
	expect(mobileLayout.actionsBelowPrompt).toBe(true);
	expect(mobileLayout.actionsWidth).toBeLessThanOrEqual(224);
	expect(Math.abs(mobileLayout.controlGap)).toBeLessThan(1);
});
