import { sortNewestFirst } from "../../lib/sort.ts";
import type { ProgressEntry, SyncKey } from "../../types/browser.ts";
import { syncProgress, syncProgressErrorMessage } from "./api.ts";
import { readProgress, saveProgressEntries, saveSyncKey } from "./storage.ts";

function localEntries(): readonly ProgressEntry[] {
	return sortNewestFirst(Object.values(readProgress()));
}

export async function synchronizeProgress(key: SyncKey): Promise<void> {
	await syncProgress(key, localEntries()).match(
		(merged) => saveProgressEntries(merged),
		(error) => {
			throw new Error(syncProgressErrorMessage(error));
		},
	);
}

export function persistSyncKey(key: SyncKey): void {
	if (saveSyncKey(key).kind === "StorageMutationError") {
		throw new Error("同期設定をこの端末へ保存できませんでした");
	}
}
