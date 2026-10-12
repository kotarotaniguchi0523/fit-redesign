import type { ProgressEntry } from "../../types/browser.ts";
import { syncProgress } from "./progressApi.ts";
import { mergeStoredProgress, readSyncKey, recordReveal } from "./progressStorage.ts";

export function recordProgressEntry(entry: ProgressEntry): void {
	recordReveal(entry);
	const syncKey = readSyncKey();
	if (syncKey) {
		syncProgress(syncKey, [entry]).map(mergeStoredProgress);
	}
}
