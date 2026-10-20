import { expect, type Page } from "@playwright/test";

const ANSWER_PANEL_MOTION_TARGET = ".q-answer-panel, .exam-answer";

export async function observeAnswerPanelMotion(page: Page): Promise<void> {
	await page.evaluate((targetSelector) => {
		const recordMotionStart = (event: Event): void => {
			const target = event.target;
			if (target instanceof Element && target.matches(targetSelector)) {
				document.documentElement.setAttribute("data-test-answer-panel-motion", "started");
			}
		};

		document.addEventListener("transitionrun", recordMotionStart);
		document.addEventListener("animationstart", recordMotionStart);
	}, ANSWER_PANEL_MOTION_TARGET);
}

export async function expectAnswerPanelMotion(page: Page): Promise<void> {
	await expect(page.locator("html")).toHaveAttribute("data-test-answer-panel-motion", "started");
}
