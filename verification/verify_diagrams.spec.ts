import { test, expect } from '@playwright/test';

test('verify automata and tree diagrams', async ({ page }) => {
  // 1. Go to home
  await page.goto('http://localhost:5173/');

  // --- Automaton (Exam 6, 2013) ---
  console.log('Navigating to Automaton 2013...');

  // Click "オートマトン" tab
  await page.getByRole('tab', { name: 'オートマトン' }).click();

  // Select Year 2013
  // It's a radio button with text "2013年度"
  await page.getByText('2013年度').click();

  // Wait for the diagram to appear.
  await expect(page.getByText('以下の状態遷移図で定義される有限オートマトンがある')).toBeVisible();

  // Locate the specific question card
  const automataCard = page.locator('.mb-4').filter({ hasText: '以下の状態遷移図で定義される有限オートマトンがある' });
  await automataCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await automataCard.screenshot({ path: 'verification/after_automaton.png' });

  // --- Binary Tree (Exam 8, 2014) ---
  console.log('Navigating to Tree 2014...');

  // Click "データ構造" tab
  await page.getByRole('tab', { name: 'データ構造' }).click();

  // Select Year 2014
  await page.getByText('2014年度').click();

  // Select Exam 8 (Sub-tab)
  // "小テスト8" inside the sub-selector. It's a button/tab.
  await page.getByRole('tab', { name: /小テスト8/ }).click();

  // Wait for Question 3 ("空の二分木に...")
  await expect(page.getByText('空の二分木に次の順でデータを追加した時')).toBeVisible();

  // Locate the question card
  const treeCard = page.locator('.mb-4').filter({ hasText: '空の二分木に次の順でデータを追加した時' });
  await treeCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await treeCard.screenshot({ path: 'verification/after_tree.png' });
});
