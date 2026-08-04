import { useSyncExternalStore } from "hono/jsx";
import { latestProgress } from "../progress/progress";
import {
	parseProgressSnapshot,
	readProgressSnapshot,
	subscribeToProgress,
} from "../progress/progressStorage";

export type QuestionLocation = Readonly<{
	questionId: string;
	unitName: string;
	year: string;
	href: string;
}>;

export function useContinueLearning(
	locations: readonly QuestionLocation[],
): QuestionLocation | undefined {
	const snapshot = useSyncExternalStore(subscribeToProgress, readProgressSnapshot, () => null);
	const latestId = latestProgress(Object.values(parseProgressSnapshot(snapshot)))?.questionId;
	return locations.find((location) => location.questionId === latestId);
}
