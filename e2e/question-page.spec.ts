import { expect, test } from "./fixtures";

test("通常問題ページの操作欄をデスクトップとスマホで表示する", async ({ page, questionSet }) => {
	await page.setViewportSize({ width: 1365, height: 936 });
	await questionSet.open();
	await expect(page.getByRole("link", { name: "テストPDF ↗" }).first()).toBeVisible();
	const desktop = await questionSet.readLayout();

	await expect(questionSet.copyButton).toBeVisible();
	await expect(questionSet.timerLink).toBeVisible();
	expect(desktop.containerWidth).toBeLessThanOrEqual(832);
	expect(desktop.containerCenterOffset).toBeLessThan(1);
	expect(desktop.pdfTop).toBeLessThan(desktop.titleBottom);
	expect(desktop.pdfLeft).toBeGreaterThanOrEqual(desktop.titleRight);
	expect(desktop.startTop).toBeGreaterThanOrEqual(desktop.titleBottom);
	expect(desktop.startWidth).toBeLessThanOrEqual(145);
	expect(desktop.answerWidth).toBeLessThanOrEqual(125);
	expect(desktop.numberBadgeWidth).toBe(24);
	expect(desktop.numberBadgeHeight).toBe(24);
	expect(desktop.promptRight).toBeLessThanOrEqual(desktop.actionsLeft);
	expect(desktop.actionsWidth).toBeLessThanOrEqual(128);
	expect(desktop.copyTop).toBeLessThan(desktop.timerTop);
	expect(Math.abs(desktop.timerTop - desktop.copyBottom)).toBeLessThan(1);

	await page.setViewportSize({ width: 390, height: 844 });
	const mobile = await questionSet.readLayout();

	expect(mobile.documentWidth).toBeLessThanOrEqual(mobile.documentClientWidth);
	expect(mobile.pdfTop).toBeLessThan(mobile.titleBottom);
	expect(mobile.pdfLeft).toBeGreaterThanOrEqual(mobile.titleRight);
	expect(mobile.startTop).toBeGreaterThanOrEqual(mobile.titleBottom);
	expect(mobile.startWidth).toBeLessThanOrEqual(145);
	expect(mobile.answerWidth).toBeLessThanOrEqual(125);
	expect(mobile.numberBadgeWidth).toBe(24);
	expect(mobile.numberBadgeHeight).toBe(24);
	expect(mobile.actionsWidth).toBeLessThanOrEqual(100);
	expect(mobile.actionsBottom).toBeLessThanOrEqual(mobile.promptTop);
	expect(Math.abs(mobile.copyTop - mobile.timerTop)).toBeLessThan(1);
	expect(Math.abs(mobile.copyRight - mobile.timerLeft)).toBeLessThan(1);
	expect(mobile.copyWidth).toBeGreaterThanOrEqual(44);
	expect(mobile.copyHeight).toBeGreaterThanOrEqual(44);
	expect(mobile.timerWidth).toBeGreaterThanOrEqual(44);
	expect(mobile.timerHeight).toBeGreaterThanOrEqual(44);

	await page.setViewportSize({ width: 320, height: 640 });
	const narrowMobile = await questionSet.readLayout();
	expect(narrowMobile.documentWidth).toBeLessThanOrEqual(narrowMobile.documentClientWidth);
	expect(narrowMobile.pdfTop).toBeLessThan(narrowMobile.titleBottom);
	expect(narrowMobile.pdfLeft).toBeGreaterThanOrEqual(narrowMobile.titleRight);
	expect(narrowMobile.startWidth).toBeLessThanOrEqual(145);
	expect(narrowMobile.answerWidth).toBeLessThanOrEqual(125);
	expect(narrowMobile.numberBadgeWidth).toBe(24);
	expect(narrowMobile.numberBadgeHeight).toBe(24);
	expect(narrowMobile.actionsBottom).toBeLessThanOrEqual(narrowMobile.promptTop);
});
