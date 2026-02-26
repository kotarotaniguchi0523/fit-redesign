import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ viewport: { width: 1280, height: 1000 } });

test('verify start button appearance', async ({ page }) => {
  // Go to the home page where UnitTabs are rendered
  await page.goto('http://localhost:5173/');

  // Wait for network to be idle
  await page.waitForLoadState('networkidle');

  // Find the button with "開始" text
  const startButton = page.getByRole('button', { name: '開始' }).first();
  await expect(startButton).toBeVisible({ timeout: 10000 });

  // Scroll into view
  await startButton.scrollIntoViewIfNeeded();

  // Wait a bit
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: 'verification/start_button_improved.png' });
});
