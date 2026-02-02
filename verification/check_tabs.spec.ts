import { test, expect } from '@playwright/test';

test('check unit tabs and quiz switching', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:5173/');

  // Click on "集合と確率" (Sets and Probability)
  await page.getByRole('tab', { name: '集合と確率' }).click();

  // Select 2013 year. Use getByText since the Radio component structure might be complex
  await page.getByText('2013年度').click();

  // Wait for the "Switch Quiz" section to appear
  const switchQuizSection = page.locator('text=小テストを切り替え');
  await expect(switchQuizSection).toBeVisible({ timeout: 10000 });

  // Take screenshot of the whole unit content area
  // We want to verify the "Switch Quiz" buttons layout
  await page.locator('.p-4.bg-white.rounded-xl').screenshot({ path: 'verification/tabs-mobile-fix.png' });
});
