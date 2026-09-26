import { useSyncExternalStore } from "hono/jsx";
import { latestProgress } from "../progress/progress";
import {
	parseProgressSnapshot,
	readProgressSnapshot,
	subscribeToProgress,
} from "../progress/progressStorage";
import type { QuestionLocationGroup } from "./continueLearningTypes";

export type QuestionLocation = Readonly<{
	questionId: string;
	unitName: string;
	year: string;
	href: string;
}>;

export function findQuestionLocation(
	locationGroups: readonly QuestionLocationGroup[],
	questionId: string | undefined,
): QuestionLocation | undefined {
	if (!questionId) {
		return undefined;
	}
	const group = locationGroups.find((candidate) => candidate.questionIds.includes(questionId));
	return group
		? {
				questionId,
				unitName: group.unitName,
				year: group.year,
				href: `${group.hrefPrefix}${questionId}`,
			}
		: undefined;
}

export function useContinueLearning(
	locationGroups: readonly QuestionLocationGroup[],
): QuestionLocation | undefined {
	const snapshot = useSyncExternalStore(subscribeToProgress, readProgressSnapshot, () => null);
	const latestId = latestProgress(Object.values(parseProgressSnapshot(snapshot)))?.questionId;
	return findQuestionLocation(locationGroups, latestId);
}
