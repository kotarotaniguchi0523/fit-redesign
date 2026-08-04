export type { ProgressEntry } from "../../types/domain";

import type { ProgressEntry } from "../../types/domain";

export type ProgressMap = Readonly<Record<string, ProgressEntry>>;

export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function hasPlausibleRevealTime(
	entry: ProgressEntry,
	nowEpochMilliseconds: number,
): boolean {
	return entry.revealedAt <= nowEpochMilliseconds + MAX_FUTURE_CLOCK_SKEW_MS;
}

function indexLatestProgress(entries: readonly ProgressEntry[]): Map<string, ProgressEntry> {
	return entries.reduce((indexed, entry) => {
		const current = indexed.get(entry.questionId);
		if (!current || entry.revealedAt > current.revealedAt) {
			indexed.set(entry.questionId, entry);
		}
		return indexed;
	}, new Map<string, ProgressEntry>());
}

export function mergeProgressEntries(
	local: readonly ProgressEntry[],
	remote: readonly ProgressEntry[],
): ProgressEntry[] {
	return [...indexLatestProgress([...local, ...remote]).values()].sort(
		(a, b) => b.revealedAt - a.revealedAt,
	);
}

export function toProgressMap(entries: readonly ProgressEntry[]): ProgressMap {
	return Object.fromEntries(entries.map((entry) => [entry.questionId, entry]));
}

export function latestProgress(entries: readonly ProgressEntry[]): ProgressEntry | undefined {
	return entries.reduce<ProgressEntry | undefined>(
		(latest, entry) => (!latest || entry.revealedAt > latest.revealedAt ? entry : latest),
		undefined,
	);
}
