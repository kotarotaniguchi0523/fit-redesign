import { useRef } from "hono/jsx";
import type { QuestionId, UnitTabId } from "../../types";
import { syncProgress } from "../progress/progressApi";
import { mergeStoredProgress, readSyncKey, recordReveal } from "../progress/progressStorage";

export function useSolutionReveal(
	questionId: QuestionId,
	unitId: UnitTabId,
): (event: Event) => void {
	const hasRecorded = useRef(false);
	return (event: Event): void => {
		if (!(event.currentTarget as HTMLDetailsElement).open || hasRecorded.current) {
			return;
		}
		hasRecorded.current = true;
		const entry = { questionId, unitId, revealedAt: Date.now() };
		recordReveal(entry);
		const syncKey = readSyncKey();
		if (syncKey) {
			syncProgress(syncKey, [entry]).map(mergeStoredProgress);
		}
	};
}
