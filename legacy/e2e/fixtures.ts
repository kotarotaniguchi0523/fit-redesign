import { test as base, expect } from "@playwright/test";
import { ChallengePlayerPage } from "./pages/challenge-player.page";
import { QuestionSetPage } from "./pages/question-set.page";

type PageObjects = {
	challengePlayer: ChallengePlayerPage;
	questionSet: QuestionSetPage;
};

export const test = base.extend<PageObjects>({
	challengePlayer: async ({ page }, use): Promise<void> => {
		await use(new ChallengePlayerPage(page));
	},
	questionSet: async ({ page }, use): Promise<void> => {
		await use(new QuestionSetPage(page));
	},
});

export { expect };
