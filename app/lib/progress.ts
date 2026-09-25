import type { ProgressEntry } from "../types/domain";

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

/**
 * Keep the latest entry for each question while retaining its earliest creation time.
 * The input is only read; the returned array and any changed entries are newly created.
 */
export function mergeLatestProgressEntries(entries: readonly ProgressEntry[]): ProgressEntry[] {
	return Array.from(Map.groupBy(entries, (entry) => entry.questionId).values(), (duplicates) => {
		const first = duplicates[0];
		if (!first) {
			throw new Error("A grouped progress list cannot be empty");
		}
		const [latest, earliestCreatedAt] = duplicates.reduce<[ProgressEntry, number]>(
			([currentLatest, currentCreatedAt], entry) => [
				entry.updatedAt > currentLatest.updatedAt ? entry : currentLatest,
				Math.min(currentCreatedAt, entry.createdAt),
			],
			[first, first.createdAt],
		);
		return latest.createdAt === earliestCreatedAt
			? latest
			: { ...latest, createdAt: earliestCreatedAt as ProgressEntry["createdAt"] };
	});
}
