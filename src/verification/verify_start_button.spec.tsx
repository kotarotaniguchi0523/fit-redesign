import { test, expect } from '@playwright/test';

test('verify start button appearance', async ({ page }) => {
  await page.goto('/');

  // Find the button with text "開始"
  // It might be inside a list, so .first() is good.
  const startButton = page.getByRole('button', { name: '開始' }).first();
  await expect(startButton).toBeVisible();

  // Take a screenshot of the button
  await startButton.screenshot({ path: 'verification/start_button_improved.png' });
});
