import { expect, test } from "./fixtures";

test("通常問題ページの操作欄をデスクトップとスマホで表示する", async ({ page, questionSet }) => {
	await page.setViewportSize({ width: 1365, height: 936 });
	await questionSet.open();
	const desktop = await questionSet.readLayout();

	await expect(questionSet.copyButton).toBeVisible();
	await expect(questionSet.timerLink).toBeVisible();
	expect(desktop.containerWidth).toBeLessThanOrEqual(832);
	expect(desktop.containerCenterOffset).toBeLessThan(1);
	expect(desktop.answerWidth).toBeLessThanOrEqual(240);
	expect(desktop.promptRight).toBeLessThanOrEqual(desktop.actionsLeft);
	expect(desktop.actionsWidth).toBeLessThanOrEqual(128);
	expect(desktop.copyTop).toBeLessThan(desktop.timerTop);
	expect(Math.abs(desktop.timerTop - desktop.copyBottom)).toBeLessThan(1);

	await page.setViewportSize({ width: 390, height: 844 });
	const mobile = await questionSet.readLayout();

	expect(mobile.documentWidth).toBe(mobile.viewportWidth);
	expect(mobile.actionsWidth).toBeLessThanOrEqual(224);
	expect(mobile.actionsTop).toBeGreaterThanOrEqual(mobile.promptBottom);
	expect(mobile.copyTop).toBeLessThan(mobile.timerTop);
	expect(Math.abs(mobile.timerTop - mobile.copyBottom)).toBeLessThan(1);
});
