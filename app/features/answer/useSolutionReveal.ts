import { useRef } from "hono/jsx";
import { type Clock, systemClock } from "../../lib/dateTime";
import { EpochMillisecondsSchema, type QuestionId, type UnitTabId } from "../../types/browser";
import { recordProgressEntry } from "../progress/progressPersistence";

export function useSolutionReveal(
	questionId: QuestionId,
	unitId: UnitTabId,
	clock: Clock = systemClock,
): (event: Event) => void {
	const wasOpen = useRef(false);
	return (event: Event): void => {
		if (!(event.currentTarget instanceof HTMLDetailsElement)) {
			return;
		}
		if (!event.currentTarget.open) {
			wasOpen.current = false;
			return;
		}
		if (wasOpen.current) {
			return;
		}
		wasOpen.current = true;
		const timestamp = EpochMillisecondsSchema.safeParse(clock.nowEpochMilliseconds());
		if (!timestamp.success) {
			return;
		}
		const entry = {
			questionId,
			unitId,
			createdAt: timestamp.data,
			updatedAt: timestamp.data,
		};
		recordProgressEntry(entry);
	};
}
