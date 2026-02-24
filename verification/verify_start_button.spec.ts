import { test, expect } from '@playwright/test';

test('verify start button style', async ({ page }) => {
  // Navigate to the verification page
  await page.goto('http://localhost:5173/verification');

  // Wait for the button to appear. The button text is "開始" (Start)
  // We use a locator that finds the button containing the text "開始"
  const startButton = page.locator('button').filter({ hasText: '開始' });
  await expect(startButton).toBeVisible();

  // Take a screenshot of the button
  await startButton.screenshot({ path: 'verification/start_button.png' });
});
