export type { ProgressEntry } from "../../types/domain";

import { sortNewestFirst } from "../../lib/sort";
import type { ProgressEntry } from "../../types/domain";

export type ProgressMap = Readonly<Record<string, ProgressEntry>>;

export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function hasPlausibleProgressTime(
	entry: ProgressEntry,
	nowEpochMilliseconds: number,
): boolean {
	return (
		entry.createdAt <= entry.updatedAt &&
		entry.updatedAt <= nowEpochMilliseconds + MAX_FUTURE_CLOCK_SKEW_MS
	);
}

function indexLatestProgress(entries: readonly ProgressEntry[]): Map<string, ProgressEntry> {
	return entries.reduce((indexed, entry) => {
		const current = indexed.get(entry.questionId);
		if (!current) {
			indexed.set(entry.questionId, entry);
		} else if (entry.updatedAt > current.updatedAt) {
			indexed.set(entry.questionId, {
				...entry,
				createdAt: Math.min(entry.createdAt, current.createdAt) as ProgressEntry["createdAt"],
			});
		} else if (entry.updatedAt === current.updatedAt && entry.createdAt < current.createdAt) {
			indexed.set(entry.questionId, {
				...current,
				createdAt: entry.createdAt,
			});
		}
		return indexed;
	}, new Map<string, ProgressEntry>());
}

export function mergeProgressEntries(
	local: readonly ProgressEntry[],
	remote: readonly ProgressEntry[],
): ProgressEntry[] {
	return sortNewestFirst([...indexLatestProgress([...local, ...remote]).values()]);
}

export function toProgressMap(entries: readonly ProgressEntry[]): ProgressMap {
	return Object.fromEntries(entries.map((entry) => [entry.questionId, entry]));
}

export function latestProgress(entries: readonly ProgressEntry[]): ProgressEntry | undefined {
	return entries.reduce<ProgressEntry | undefined>(
		(latest, entry) => (!latest || entry.updatedAt > latest.updatedAt ? entry : latest),
		undefined,
	);
}
