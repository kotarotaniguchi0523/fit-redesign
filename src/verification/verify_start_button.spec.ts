import { expect, test } from "@playwright/test";

test("Verify Start Button Appearance", async ({ page }) => {
	// Inject style to avoid font rendering issues
	await page.addStyleTag({ content: "* { font-family: sans-serif !important; }" });

	// Go to root page
	await page.goto("http://localhost:5173/");

	// Wait for the button to appear. The button text is "開始" (Start)
	const startButton = page.getByRole("button", { name: "開始" }).first();
	await expect(startButton).toBeVisible();

	// Take a screenshot of the initial state (Start)
	await page.screenshot({ path: "src/verification/start_button_after.png" });

	// Click the button to start the timer
	await startButton.click();

	// Wait for the button text to change to "停止" (Stop)
	const stopButton = page.getByRole("button", { name: "停止" });
	await expect(stopButton).toBeVisible();

	// Take a screenshot of the running state (Stop)
	await page.screenshot({ path: "src/verification/stop_button_after.png" });

	// Stop the timer
	await stopButton.click();

	// Reset if necessary (optional, but good practice)
	const resetButton = page.getByRole("button", { name: "リセット" });
	if (await resetButton.isVisible()) {
		await resetButton.click();
	}
});
