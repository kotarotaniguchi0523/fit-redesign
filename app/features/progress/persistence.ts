import type { ProgressEntry } from "../../types/browser.ts";
import { syncProgress } from "./api.ts";
import { mergeStoredProgress, readSyncKey, recordReveal } from "./storage.ts";

export function recordProgressEntry(entry: ProgressEntry): void {
	recordReveal(entry);
	const syncKey = readSyncKey();
	if (syncKey) {
		syncProgress(syncKey, [entry]).map(mergeStoredProgress);
	}
}
