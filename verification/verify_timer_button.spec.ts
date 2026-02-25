import { test, expect } from '@playwright/test';

test('verify timer button appearance', async ({ page }) => {
  // Use a fixed viewport to ensure consistency
  await page.setViewportSize({ width: 1280, height: 720 });

  // Navigate to the home page
  await page.goto('http://localhost:5173/');

  // Locate the first "Start" button (QuestionTimer)
  // Since there are multiple questions, we can pick the first one.
  // The button text is "開始"
  const startButton = page.getByRole('button', { name: '開始' }).first();

  // Wait for it to be visible
  await expect(startButton).toBeVisible();

  // Take a screenshot of the button
  await startButton.screenshot({ path: 'verification/timer_button_start.png' });

  // Click the button
  await startButton.click();

  // Wait for the button text to change to "停止"
  const stopButton = page.getByRole('button', { name: '停止' }).first();
  await expect(stopButton).toBeVisible();

  // Take a screenshot of the button in "Stop" state
  await stopButton.screenshot({ path: 'verification/timer_button_stop.png' });
});
