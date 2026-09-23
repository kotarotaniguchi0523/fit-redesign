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
