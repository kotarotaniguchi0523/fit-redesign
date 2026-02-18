import { test, expect } from '@playwright/test';
import path from 'path';

test('verify start button appearance', async ({ page }) => {
  // Go to the home page
  await page.goto('/');

  // Wait for the page to load and content to appear
  // We look for the "Start" button (開始)
  const startButton = page.getByRole('button', { name: '開始' }).first();

  // Wait for it to be visible
  await expect(startButton).toBeVisible({ timeout: 10000 });

  // Scroll to the button to ensure it's in view
  await startButton.scrollIntoViewIfNeeded();

  // Take a screenshot of the button element
  await startButton.screenshot({ path: 'verification/start_button_improved.png' });

  // Also take a screenshot of the surrounding area (Question Timer)
  // The button is inside a div with relative class in QuestionTimer
  // We can try to find the container.
  // The structure is: div.relative > div.flex > Button
  const timerContainer = startButton.locator('..').locator('..');
  await timerContainer.screenshot({ path: 'verification/timer_area_improved.png' });
});
