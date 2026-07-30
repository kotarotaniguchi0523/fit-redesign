import type { QuestionId, UnitTabId } from "../../types";

export const PROGRESS_STORAGE_KEY = "fit-question-progress-v1";
export const SYNC_KEY_STORAGE_KEY = "fit-sync-key-v1";

export interface ProgressEntry {
	questionId: QuestionId;
	unitId: UnitTabId;
	revealedAt: number;
}

type ProgressMap = Record<string, ProgressEntry>;

function isProgressEntry(value: unknown): value is ProgressEntry {
	if (!value || typeof value !== "object") {
		return false;
	}
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.questionId === "string" &&
		typeof entry.unitId === "string" &&
		typeof entry.revealedAt === "number" &&
		Number.isFinite(entry.revealedAt)
	);
}

export function readProgress(): ProgressMap {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "{}");
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isProgressEntry(value)));
	} catch {
		return {};
	}
}

export function recordReveal(entry: ProgressEntry): void {
	try {
		const progress = readProgress();
		progress[entry.questionId] = entry;
		localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
	} catch {
		// 記録は補助機能。保存できなくても答えの表示を妨げない。
	}
}

export async function syncProgressEntry(entry: ProgressEntry): Promise<void> {
	let syncKey: string | null = null;
	try {
		syncKey = localStorage.getItem(SYNC_KEY_STORAGE_KEY);
	} catch {
		return;
	}
	if (!syncKey) {
		return;
	}

	try {
		await fetch("/progress/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Sync-Key": syncKey },
			body: JSON.stringify({ entries: [entry] }),
		});
	} catch {
		// ローカル記録が正本として残るため、次回の同期で再試行できる。
	}
}
