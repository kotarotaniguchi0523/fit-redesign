export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isPlausibleSyncTimeRange(
	createdAt: number,
	updatedAt: number,
	nowEpochMilliseconds: number,
): boolean {
	return createdAt <= updatedAt && updatedAt <= nowEpochMilliseconds + MAX_FUTURE_CLOCK_SKEW_MS;
}
