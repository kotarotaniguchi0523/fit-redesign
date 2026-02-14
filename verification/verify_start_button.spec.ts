import { test, expect } from '@playwright/test';

test('Verify Start Button Appearance', async ({ page }) => {
  console.log('Navigating to home page...');
  await page.goto('http://localhost:5173/');

  console.log('Waiting for Start button...');
  // Find the button with text "開始"
  const startButton = page.getByRole('button', { name: '開始' }).first();
  await expect(startButton).toBeVisible({ timeout: 10000 });

  console.log('Taking screenshot...');
  await startButton.scrollIntoViewIfNeeded();

  // Capture a slightly larger area if possible, or just the button
  // Capturing the button element
  await startButton.screenshot({ path: 'verification/start_button_element.png' });

  // Capture the surrounding context (QuestionCard)
  // The button is inside a QuestionCard. Let's try to find the parent card.
  // We can just screenshot the viewport to be safe.
  await page.screenshot({ path: 'verification/full_page.png' });
});
