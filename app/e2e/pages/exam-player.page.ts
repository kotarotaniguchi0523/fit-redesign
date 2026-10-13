import type { Locator, Page } from "playwright/test";

/**
 * 小テストプレイヤー（`/unit-<unit>/<year>/exam/<n>`）の Page Object。
 *
 * サーバー描画（JS なし）では静的なプレビュー（`data-player="preview"`）が出る。
 * 島が hydrate すると操作可能な本体（`data-player="interactive"`）へ置き換わるため、
 * 操作の前には `waitForInteractive()` を挟んでハイドレーション完了を待つ。
 */
export class ExamPlayerPage {
	constructor(private readonly page: Page) {}

	async open(unitId: string, year: string, examNumber: number): Promise<void> {
		await this.page.goto(`/${unitId}/${year}/exam/${examNumber}`);
	}

	/** プレビュー・本体のどちらでもよい「プレイヤーが描画された」ことの確認用。 */
	get anyPlayer(): Locator {
		return this.page.locator("[data-player]").first();
	}

	/** 島が hydrate した後の操作可能な本体。 */
	get interactive(): Locator {
		return this.page.locator('[data-player="interactive"]');
	}

	/** ハイドレーション完了を待つ（これが通れば島は動作している）。 */
	async waitForInteractive(): Promise<void> {
		try {
			await this.interactive.waitFor();
		} catch (error) {
			// 失敗時にページ側の手掛かりを残す（ハイドレーションは DOM マーカーと
			// 埋め込みデータ（script#rmx-data）が揃って初めて走る）。
			console.error(
				"[player] hydration did not complete",
				JSON.stringify(
					await this.page.evaluate(() => ({
						scripts: [...document.scripts].map((script) => ({
							id: script.id,
							type: script.type,
							src: script.getAttribute("src"),
							text: script.textContent.length,
						})),
						markers: document.querySelectorAll("[class^='rmxc-']").length,
						hydrationMarkers: (() => {
							let count = 0;
							const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
							while (walker.nextNode()) {
								if ((walker.currentNode as Comment).data.includes("rmx:h:")) {
									count += 1;
								}
							}
							return count;
						})(),
						player: document.querySelector("[data-player]")?.getAttribute("data-player"),
						rmx: (globalThis as unknown as Record<string, unknown>).__rmxDiagnostics ?? null,
						readyState: document.readyState,
						clientJs: performance
							.getEntriesByType("resource")
							.filter((entry) => entry.name.includes("client.js"))
							.map((entry) => ({
								name: entry.name,
								size: (entry as PerformanceResourceTiming).transferSize,
							})),
						nav: (() => {
							const nav = performance.getEntriesByType("navigation")[0] as
								| PerformanceNavigationTiming
								| undefined;
							return nav
								? {
										duration: Math.round(nav.duration),
										domComplete: Math.round(nav.domComplete),
										responseEnd: Math.round(nav.responseEnd),
									}
								: null;
						})(),
					})),
				),
			);
			const response = await this.page.request.get(this.page.url());
			const html = await response.text();
			const dataScript = /<script type="application\/json" id="rmx-data">([\s\S]*?)<\/script>/.exec(
				html,
			);
			console.error(
				"[player] ssr html",
				JSON.stringify({
					status: response.status(),
					length: html.length,
					rmxDataLength: dataScript ? dataScript[1].length : null,
				}),
			);
			throw error;
		}
	}

	get revealAnswerButton(): Locator {
		return this.page.getByRole("button", { name: "解答を表示" });
	}

	get answerHeading(): Locator {
		return this.page.getByRole("heading", { name: "解答", exact: true });
	}

	get openQuestionListButton(): Locator {
		return this.page.getByRole("button", { name: "問題一覧を開く" });
	}

	get questionListPanel(): Locator {
		return this.page.getByRole("complementary", { name: "問題一覧" });
	}

	async revealAnswer(): Promise<void> {
		await this.revealAnswerButton.click();
		await this.answerHeading.waitFor();
	}

	async judge(judgment: "correct" | "incorrect"): Promise<void> {
		const label = judgment === "correct" ? "正解として記録" : "不正解として記録";
		await this.page.getByRole("button", { name: label }).click();
	}
}
