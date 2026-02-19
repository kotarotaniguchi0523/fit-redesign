import { expect, test } from "@playwright/test";

test("verify start button styling", async ({ page }) => {
	// 1. Navigate to the app
	await page.goto("http://localhost:5173");

	// 2. Wait for the page to load and find the Start button
	// The button has text "開始" (Start).
	// initially it should be "開始".
	const startButton = page.getByRole("button", { name: "開始" }).first();

	await expect(startButton).toBeVisible();

	// 3. Take a screenshot of the button
	await startButton.screenshot({ path: "src/verification/start_button_improved.png" });
});
