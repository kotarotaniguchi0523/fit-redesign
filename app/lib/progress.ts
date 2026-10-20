import type { ProgressEntry } from "../types/domain";

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
		const [latest, earliestCreatedAt] = duplicates.reduce<
			[ProgressEntry, ProgressEntry["createdAt"]]
		>(
			([currentLatest, currentCreatedAt], entry) => [
				entry.updatedAt > currentLatest.updatedAt ? entry : currentLatest,
				entry.createdAt < currentCreatedAt ? entry.createdAt : currentCreatedAt,
			],
			[first, first.createdAt],
		);
		return latest.createdAt === earliestCreatedAt
			? latest
			: { ...latest, createdAt: earliestCreatedAt };
	});
}
