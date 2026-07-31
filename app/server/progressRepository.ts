import { desc, eq, sql } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { ProgressEntry, type ProgressEntry as ProgressEntryType } from "./progressEntry";
import { type Db, questionProgress, syncSpaces } from "./schema";
import type { SyncSpaceId } from "./syncSpaceId";

const BATCH_SIZE = 100;

type RepositoryOperation =
	| "CreateSyncSpace"
	| "FindSyncSpace"
	| "WriteProgress"
	| "ReadProgress"
	| "DeleteSyncSpace";

export type ProgressRepositoryError =
	| Readonly<{ kind: "RepositoryError"; operation: RepositoryOperation; cause: unknown }>
	| Readonly<{ kind: "InvalidStoredProgress"; syncSpaceId: SyncSpaceId; issues: unknown }>
	| Readonly<{ kind: "SyncSpaceNotFound"; syncSpaceId: SyncSpaceId }>;

export const ProgressRepositoryError = {
	isUnknownSpace: (error: ProgressRepositoryError): boolean => error.kind === "SyncSpaceNotFound",
} as const;

function repositoryError(
	operation: RepositoryOperation,
): (cause: unknown) => ProgressRepositoryError {
	return (cause): ProgressRepositoryError => ({ kind: "RepositoryError", operation, cause });
}

function mergeProgressEntries(entries: readonly ProgressEntryType[]): readonly ProgressEntryType[] {
	const merged = entries.reduce<Map<string, ProgressEntryType>>((result, entry) => {
		const current = result.get(entry.questionId);
		if (!current || entry.revealedAt > current.revealedAt) {
			result.set(entry.questionId, entry);
		}
		return result;
	}, new Map());
	return [...merged.values()];
}

function chunksOf<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
	return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
		values.slice(index * size, (index + 1) * size),
	);
}

export function createSyncSpace(
	db: Db,
	syncSpaceId: SyncSpaceId,
): ResultAsync<void, ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.insert(syncSpaces)
			.values({ id: syncSpaceId, createdAt: Date.now() })
			.then(() => undefined),
		repositoryError("CreateSyncSpace"),
	);
}

function writeProgress(
	db: Db,
	syncSpaceId: SyncSpaceId,
	entries: readonly ProgressEntryType[],
): ResultAsync<void, ProgressRepositoryError> {
	return chunksOf(mergeProgressEntries(entries), BATCH_SIZE).reduce<
		ResultAsync<void, ProgressRepositoryError>
	>(
		(result, chunk) =>
			result.andThen(() => {
				if (chunk.length === 0) {
					return okAsync(undefined);
				}
				const statements = chunk.map((entry) =>
					db
						.insert(questionProgress)
						.values({ syncSpaceId, ...entry })
						.onConflictDoUpdate({
							target: [questionProgress.syncSpaceId, questionProgress.questionId],
							set: {
								unitId: sql`CASE WHEN excluded.revealed_at > ${questionProgress.revealedAt} THEN excluded.unit_id ELSE ${questionProgress.unitId} END`,
								revealedAt: sql`MAX(${questionProgress.revealedAt}, excluded.revealed_at)`,
							},
						}),
				);
				const [first, ...rest] = statements;
				if (!first) {
					return okAsync(undefined);
				}
				return ResultAsync.fromPromise(
					db.batch([first, ...rest]).then(() => undefined),
					repositoryError("WriteProgress"),
				);
			}),
		okAsync(undefined),
	);
}

function readProgress(
	db: Db,
	syncSpaceId: SyncSpaceId,
): ResultAsync<readonly ProgressEntryType[], ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.select({
				questionId: questionProgress.questionId,
				unitId: questionProgress.unitId,
				revealedAt: questionProgress.revealedAt,
			})
			.from(questionProgress)
			.where(eq(questionProgress.syncSpaceId, syncSpaceId))
			.orderBy(desc(questionProgress.revealedAt)),
		repositoryError("ReadProgress"),
	).andThen((rows) =>
		ProgressEntry.parseList(rows).mapErr(
			(validationError): ProgressRepositoryError => ({
				kind: "InvalidStoredProgress",
				syncSpaceId,
				issues: validationError.issues,
			}),
		),
	);
}

export function syncProgress(
	db: Db,
	syncSpaceId: SyncSpaceId,
	entries: readonly ProgressEntryType[],
): ResultAsync<readonly ProgressEntryType[], ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.select({ id: syncSpaces.id })
			.from(syncSpaces)
			.where(eq(syncSpaces.id, syncSpaceId))
			.limit(1),
		repositoryError("FindSyncSpace"),
	).andThen(([space]) =>
		space
			? writeProgress(db, syncSpaceId, entries).andThen(() => readProgress(db, syncSpaceId))
			: errAsync<readonly ProgressEntryType[], ProgressRepositoryError>({
					kind: "SyncSpaceNotFound",
					syncSpaceId,
				}),
	);
}

export function deleteSyncSpace(
	db: Db,
	syncSpaceId: SyncSpaceId,
): ResultAsync<void, ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.batch([
				db.delete(questionProgress).where(eq(questionProgress.syncSpaceId, syncSpaceId)),
				db.delete(syncSpaces).where(eq(syncSpaces.id, syncSpaceId)),
			])
			.then(() => undefined),
		repositoryError("DeleteSyncSpace"),
	);
}
