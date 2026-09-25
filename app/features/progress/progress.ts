export type { ProgressEntry } from "../../types/domain";

import { mergeLatestProgressEntries } from "../../lib/progress";
import { sortNewestFirst } from "../../lib/sort";
import type { ProgressEntry } from "../../types/domain";

export type ProgressMap = Readonly<Record<string, ProgressEntry>>;

export function mergeProgressEntries(
	local: readonly ProgressEntry[],
	remote: readonly ProgressEntry[],
): ProgressEntry[] {
	return sortNewestFirst(mergeLatestProgressEntries([...local, ...remote]));
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
