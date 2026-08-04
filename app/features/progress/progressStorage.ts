import {
	isProgressEntry,
	mergeProgressEntries,
	type ProgressEntry,
	type ProgressMap,
	toProgressMap,
} from "./progress";

export const PROGRESS_STORAGE_KEY = "fit-question-progress-v1";
export const SYNC_KEY_STORAGE_KEY = "fit-sync-key-v1";
const PROGRESS_CHANGE_EVENT = "fit:progress-change";
const SYNC_KEY_CHANGE_EVENT = "fit:sync-key-change";

function notifyStorageChange(eventName: string): void {
	window.dispatchEvent(new Event(eventName));
}

function subscribeToStorage(key: string, eventName: string, onStoreChange: () => void): () => void {
	const onStorage = (event: StorageEvent): void => {
		if (event.key === key) {
			onStoreChange();
		}
	};
	window.addEventListener("storage", onStorage);
	window.addEventListener(eventName, onStoreChange);
	return (): void => {
		window.removeEventListener("storage", onStorage);
		window.removeEventListener(eventName, onStoreChange);
	};
}

export function subscribeToProgress(onStoreChange: () => void): () => void {
	return subscribeToStorage(PROGRESS_STORAGE_KEY, PROGRESS_CHANGE_EVENT, onStoreChange);
}

export function subscribeToSyncKey(onStoreChange: () => void): () => void {
	return subscribeToStorage(SYNC_KEY_STORAGE_KEY, SYNC_KEY_CHANGE_EVENT, onStoreChange);
}

export function readProgressSnapshot(): string | null {
	try {
		return localStorage.getItem(PROGRESS_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function readSyncKey(): string | null {
	try {
		return localStorage.getItem(SYNC_KEY_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function saveSyncKey(key: string): void {
	localStorage.setItem(SYNC_KEY_STORAGE_KEY, key);
	notifyStorageChange(SYNC_KEY_CHANGE_EVENT);
}

export function removeSyncKey(): void {
	localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
	notifyStorageChange(SYNC_KEY_CHANGE_EVENT);
}

export function parseProgressSnapshot(snapshot: string | null): ProgressMap {
	try {
		const parsed: unknown = JSON.parse(snapshot ?? "{}");
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isProgressEntry(value)));
	} catch {
		return {};
	}
}

export function readProgress(): ProgressMap {
	return parseProgressSnapshot(readProgressSnapshot());
}

export function saveProgressEntries(entries: readonly ProgressEntry[]): void {
	localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(toProgressMap(entries)));
	notifyStorageChange(PROGRESS_CHANGE_EVENT);
}

export function recordReveal(entry: ProgressEntry): void {
	try {
		saveProgressEntries(mergeProgressEntries(Object.values(readProgress()), [entry]));
	} catch {
		// 記録は補助機能。保存できなくても答えの表示を妨げない。
	}
}

export function mergeStoredProgress(entries: readonly ProgressEntry[]): void {
	try {
		saveProgressEntries(mergeProgressEntries(Object.values(readProgress()), entries));
	} catch {
		// 同期結果を保存できなくても、答えの表示と既存のローカル記録は維持する。
	}
}
