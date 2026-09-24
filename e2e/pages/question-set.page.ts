import { expect, type Locator, type Page } from "@playwright/test";

type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;

export type QuestionSetLayout = Readonly<{
	viewportWidth: number;
	documentWidth: number;
	documentClientWidth: number;
	containerWidth: number;
	containerCenterOffset: number;
	answerWidth: number;
	promptRight: number;
	promptTop: number;
	actionsLeft: number;
	actionsTop: number;
	actionsBottom: number;
	actionsWidth: number;
	copyTop: number;
	copyBottom: number;
	copyRight: number;
	copyWidth: number;
	copyHeight: number;
	timerTop: number;
	timerLeft: number;
	timerWidth: number;
	timerHeight: number;
}>;

function requireBounds(bounds: Bounds | null, target: string): Bounds {
	if (!bounds) {
		throw new Error(`${target} has no visible bounds`);
	}
	return bounds;
}

export class QuestionSetPage {
	readonly copyButton: Locator;
	readonly timerLink: Locator;
	private readonly page: Page;
	private readonly container: Locator;
	private readonly firstQuestion: Locator;
	private readonly prompt: Locator;
	private readonly actions: Locator;
	private readonly answerButton: Locator;

	constructor(page: Page) {
		this.page = page;
		const main = page.locator("main.study-shell--question-set");
		this.container = main.locator(".page-container--wide");
		this.firstQuestion = main.locator(".q-card").first();
		this.prompt = this.firstQuestion.locator(".q-text-wrap");
		this.actions = this.firstQuestion.locator(".q-card__actions");
		this.copyButton = this.actions.getByRole("button", { name: "Copy", exact: true });
		this.timerLink = this.actions.getByRole("link", { name: "時間を測る", exact: true });
		this.answerButton = this.firstQuestion.getByText("答えを確認", { exact: true });
	}

	async open(): Promise<void> {
		await this.page.goto("/unit-base-conversion/2013");
		await expect(this.container).toBeVisible();
		await expect(this.firstQuestion).toBeVisible();
		await expect(this.copyButton).toBeVisible();
		await expect(this.timerLink).toBeVisible();
	}

	async readLayout(): Promise<QuestionSetLayout> {
		const [container, prompt, actions, copy, timer, answer] = await Promise.all([
			this.container.boundingBox(),
			this.prompt.boundingBox(),
			this.actions.boundingBox(),
			this.copyButton.boundingBox(),
			this.timerLink.boundingBox(),
			this.answerButton.boundingBox(),
		]);
		const containerBounds = requireBounds(container, "Question container");
		const promptBounds = requireBounds(prompt, "Question prompt");
		const actionsBounds = requireBounds(actions, "Question actions");
		const copyBounds = requireBounds(copy, "Copy button");
		const timerBounds = requireBounds(timer, "Timer link");
		const answerBounds = requireBounds(answer, "Answer button");
		const viewport = this.page.viewportSize();
		if (!viewport) {
			throw new Error("The browser viewport is not configured");
		}
		const { scrollWidth: documentWidth, clientWidth: documentClientWidth } = await this.page
			.locator("html")
			.evaluate((element) => ({
				scrollWidth: element.scrollWidth,
				clientWidth: element.clientWidth,
			}));

		return {
			viewportWidth: viewport.width,
			documentWidth,
			documentClientWidth,
			containerWidth: containerBounds.width,
			containerCenterOffset: Math.abs(
				containerBounds.x + containerBounds.width / 2 - viewport.width / 2,
			),
			answerWidth: answerBounds.width,
			promptRight: promptBounds.x + promptBounds.width,
			promptTop: promptBounds.y,
			actionsLeft: actionsBounds.x,
			actionsTop: actionsBounds.y,
			actionsBottom: actionsBounds.y + actionsBounds.height,
			actionsWidth: actionsBounds.width,
			copyTop: copyBounds.y,
			copyBottom: copyBounds.y + copyBounds.height,
			copyRight: copyBounds.x + copyBounds.width,
			copyWidth: copyBounds.width,
			copyHeight: copyBounds.height,
			timerTop: timerBounds.y,
			timerLeft: timerBounds.x,
			timerWidth: timerBounds.width,
			timerHeight: timerBounds.height,
		};
	}
}
