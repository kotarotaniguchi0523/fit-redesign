export type { ProgressEntry } from "../../types/domain.ts";

import { mergeLatestProgressEntries } from "../../lib/progress.ts";
import { sortNewestFirst } from "../../lib/sort.ts";
import type { ProgressEntry } from "../../types/domain.ts";

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
