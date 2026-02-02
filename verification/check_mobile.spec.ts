import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 375, height: 667 },
});

test('Mobile UI Layout Check', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for initial load
  await page.waitForTimeout(3000);

  // 1. Initial State (Unit Tabs)
  await page.screenshot({ path: 'screenshots/mobile-1-initial.png', fullPage: true });

  // 2. Click "集合と確率" tab
  // Use text locator if role locator is ambiguous or strict mode fails
  await page.click('button:has-text("集合と確率")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/mobile-2-set-prob.png', fullPage: true });

  // 3. Click "論理演算" tab
  await page.click('button:has-text("論理演算")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/mobile-3-logic.png', fullPage: true });
});
