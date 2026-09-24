import { expect, type Locator, type Page } from "@playwright/test";

type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;

export type QuestionSetLayout = Readonly<{
	viewportWidth: number;
	documentWidth: number;
	documentClientWidth: number;
	containerWidth: number;
	containerCenterOffset: number;
	titleBottom: number;
	titleRight: number;
	pdfTop: number;
	pdfLeft: number;
	startTop: number;
	startWidth: number;
	answerWidth: number;
	numberBadgeWidth: number;
	numberBadgeHeight: number;
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
	private readonly title: Locator;
	private readonly pdfLink: Locator;
	private readonly startLink: Locator;
	private readonly firstQuestion: Locator;
	private readonly prompt: Locator;
	private readonly numberBadge: Locator;
	private readonly actions: Locator;
	private readonly answerButton: Locator;

	constructor(page: Page) {
		this.page = page;
		const main = page.locator("main.study-shell--question-set");
		this.container = main.locator(".page-container--wide");
		this.title = main.locator(".exam-section__title").first();
		this.pdfLink = main.locator(".exam-section__pdf").first();
		this.startLink = main.locator(".exam-section__start").first();
		this.firstQuestion = main.locator(".q-card").first();
		this.prompt = this.firstQuestion.locator(".q-text-wrap");
		this.numberBadge = this.firstQuestion.locator(".q-num");
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
		const [container, title, pdf, start, prompt, numberBadge, actions, copy, timer, answer] =
			await Promise.all([
				this.container.boundingBox(),
				this.title.boundingBox(),
				this.pdfLink.boundingBox(),
				this.startLink.boundingBox(),
				this.prompt.boundingBox(),
				this.numberBadge.boundingBox(),
				this.actions.boundingBox(),
				this.copyButton.boundingBox(),
				this.timerLink.boundingBox(),
				this.answerButton.boundingBox(),
			]);
		const containerBounds = requireBounds(container, "Question container");
		const titleBounds = requireBounds(title, "Exam title");
		const pdfBounds = requireBounds(pdf, "Test PDF link");
		const startBounds = requireBounds(start, "Start test link");
		const promptBounds = requireBounds(prompt, "Question prompt");
		const numberBadgeBounds = requireBounds(numberBadge, "Question number badge");
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
			titleBottom: titleBounds.y + titleBounds.height,
			titleRight: titleBounds.x + titleBounds.width,
			pdfTop: pdfBounds.y,
			pdfLeft: pdfBounds.x,
			startTop: startBounds.y,
			startWidth: startBounds.width,
			answerWidth: answerBounds.width,
			numberBadgeWidth: numberBadgeBounds.width,
			numberBadgeHeight: numberBadgeBounds.height,
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
