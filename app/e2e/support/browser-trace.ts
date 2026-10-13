import type { ConsoleMessage, Page } from "playwright/test";

/**
 * E2E のブラウザー側診断。
 *
 * ブラックボックスで駆動しているため、失敗の原因がページ側にある場合に
 * そのままでは見えない。エラーと失敗リクエストだけを CI のログへ出す。
 */
export function traceBrowser(page: Page): void {
	page.on("console", (message: ConsoleMessage) => {
		if (message.type() === "error" || message.type() === "warning") {
			console.error("[browser]", message.type(), message.text().slice(0, 300));
		}
	});
	page.on("pageerror", (error: Error) => {
		console.error("[browser-error]", error.message.slice(0, 500));
	});
	page.on("requestfailed", (request) => {
		console.error("[request-failed]", request.url(), request.failure()?.errorText);
	});
}
