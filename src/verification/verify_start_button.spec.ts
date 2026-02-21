import { expect, test } from "@playwright/test";

test("verify start button appearance", async ({ page }) => {
	// Go to the main page
	await page.goto("http://localhost:5173/");

	// Wait for the Start button. It has text "開始" (Start)
	const startButton = page.getByRole("button", { name: "開始" }).first();
	await expect(startButton).toBeVisible();

	// Take screenshot of Start button
	await startButton.screenshot({ path: "src/verification/start_button_initial.png" });

	// Click to start
	await startButton.click();

	// Wait for Stop button. It has text "停止" (Stop)
	const stopButton = page.getByRole("button", { name: "停止" }).first();
	await expect(stopButton).toBeVisible();

	// Take screenshot of Stop button
	await stopButton.screenshot({ path: "src/verification/start_button_stop.png" });
});
