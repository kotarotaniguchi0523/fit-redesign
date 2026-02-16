import { test, expect } from '@playwright/test';
import path from 'path';

test('capture start button', async ({ page }) => {
  // Go to app
  await page.goto('http://localhost:5173');

  // Wait for tabs to appear. The app loads with some default (slide-only usually),
  // so we need to click a unit tab that has questions.
  await page.waitForSelector('role=tablist');

  // Click the tab "基数変換" (Base Conversion)
  const tab = page.getByRole('tab', { name: '基数変換' });
  await tab.waitFor();
  await tab.click();

  // Wait for the question card to load.
  // The start button has text "開始"
  const startButton = page.locator('button').filter({ hasText: '開始' }).first();
  await startButton.waitFor({ timeout: 10000 });

  // Ensure it's visible
  await expect(startButton).toBeVisible();

  // Take screenshot of the button
  await startButton.screenshot({ path: path.join('verification', 'start_button_final.png') });

  // Also take a screenshot of the surrounding area (Question Timer) for context
  const timerContainer = startButton.locator('..').locator('..'); // Parent div of button
  await timerContainer.screenshot({ path: path.join('verification', 'start_button_context.png') });
});
