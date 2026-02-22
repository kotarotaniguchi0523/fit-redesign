import { test, expect } from '@playwright/test';

test('Start Button visual check', async ({ page }) => {
  // Go to the verification page
  await page.goto('/verification');

  // Wait for the button to be visible
  // The button text is "開始" (Start)
  const startButton = page.getByRole('button', { name: '開始' });
  await expect(startButton).toBeVisible();

  // Wait for fonts/styles to load fully
  await page.waitForTimeout(1000);

  // Take screenshot of the button specifically
  await startButton.screenshot({ path: 'verification/start_button_improved.png' });

  // Take full page screenshot just in case
  await page.screenshot({ path: 'verification/full_page_improved.png' });
});
