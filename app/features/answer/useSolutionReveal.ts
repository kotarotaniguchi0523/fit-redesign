import { useRef } from "hono/jsx";
import { type Clock, systemClock } from "../../lib/dateTime";
import { type QuestionId, RevealedAtSchema, type UnitTabId } from "../../types/browser";
import { syncProgress } from "../progress/progressApi";
import { mergeStoredProgress, readSyncKey, recordReveal } from "../progress/progressStorage";

export function useSolutionReveal(
	questionId: QuestionId,
	unitId: UnitTabId,
	clock: Clock = systemClock,
): (event: Event) => void {
	const hasRecorded = useRef(false);
	return (event: Event): void => {
		if (
			!(event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open) ||
			hasRecorded.current
		) {
			return;
		}
		hasRecorded.current = true;
		const revealedAt = RevealedAtSchema.safeParse(clock.nowEpochMilliseconds());
		if (!revealedAt.success) {
			return;
		}
		const entry = { questionId, unitId, revealedAt: revealedAt.data };
		recordReveal(entry);
		const syncKey = readSyncKey();
		if (syncKey) {
			syncProgress(syncKey, [entry]).map(mergeStoredProgress);
		}
	};
}
