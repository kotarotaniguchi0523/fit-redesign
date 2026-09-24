import { expect, type Locator, type Page } from "@playwright/test";

const TEST_PDF = /テストPDF/;
const ANSWER_TOGGLE = /解答を(表示|隠す)/;

export class QuestionSetPage {
	readonly main: Locator;
	readonly firstQuestion: Locator;
	readonly copyButton: Locator;
	readonly timerLink: Locator;
	readonly answerToggle: Locator;
	readonly answerPanel: Locator;
	readonly pdfLink: Locator;
	readonly startLink: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.main = page.locator("main");
		this.firstQuestion = this.main.locator("[data-question-card]").first();
		this.copyButton = this.firstQuestion.getByRole("button", { name: "問題文をコピー" });
		this.timerLink = this.firstQuestion.getByRole("link", { name: "タイムアタック" });
		this.answerToggle = this.firstQuestion.getByRole("button", { name: ANSWER_TOGGLE });
		this.answerPanel = this.firstQuestion.locator(".q-answer-panel");
		this.pdfLink = this.main.getByRole("link", { name: TEST_PDF }).first();
		this.startLink = this.main.getByRole("link", { name: "小テストを開始" }).first();
	}

	async open(path = "/unit-base-conversion/2013"): Promise<void> {
		await this.page.goto(path);
		await expect(this.firstQuestion).toBeVisible();
		await expect(this.copyButton).toBeVisible();
	}

	question(id: string): Locator {
		return this.main.locator(`[data-question-id="${id}"]`);
	}

	horizontalOverflow(): Promise<number> {
		return this.page.evaluate(
			() =>
				Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
				window.innerWidth,
		);
	}
}
