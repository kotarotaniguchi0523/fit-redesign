import type { ProgressEntry, SyncKey } from "../../types/browser";
import { syncProgress, syncProgressErrorMessage } from "./progressApi";
import { readProgress, saveProgressEntries, saveSyncKey } from "./progressStorage";

function localEntries(): readonly ProgressEntry[] {
	return Object.values(readProgress()).sort((a, b) => b.revealedAt - a.revealedAt);
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
