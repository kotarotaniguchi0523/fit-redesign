import type { ProgressEntry } from "../../types/browser";
import { syncProgress } from "./progressApi";
import { mergeStoredProgress, readSyncKey, recordReveal } from "./progressStorage";

export function recordProgressEntry(entry: ProgressEntry): void {
	recordReveal(entry);
	const syncKey = readSyncKey();
	if (syncKey) {
		syncProgress(syncKey, [entry]).map(mergeStoredProgress);
	}
}
