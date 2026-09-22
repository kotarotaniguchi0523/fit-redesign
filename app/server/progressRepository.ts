import { desc, eq, sql } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { ProgressEntry, type ProgressEntry as ProgressEntryType } from "./progressEntry";
import { type Db, questionProgress, syncLinks } from "./schema";
import type { SyncLinkId } from "./syncLinkId";

const BATCH_SIZE = 100;

type RepositoryOperation =
	| "CreateSyncLink"
	| "FindSyncLink"
	| "WriteProgress"
	| "ReadProgress"
	| "DeleteSyncLink";

export type ProgressRepositoryError =
	| Readonly<{ kind: "RepositoryError"; operation: RepositoryOperation; cause: unknown }>
	| Readonly<{ kind: "InvalidStoredProgress"; syncLinkId: SyncLinkId; issues: unknown }>
	| Readonly<{ kind: "SyncLinkNotFound"; syncLinkId: SyncLinkId }>;

export const ProgressRepositoryError = {
	isUnknownLink: (error: ProgressRepositoryError): boolean => error.kind === "SyncLinkNotFound",
} as const;

function repositoryError(
	operation: RepositoryOperation,
): (cause: unknown) => ProgressRepositoryError {
	return (cause): ProgressRepositoryError => ({ kind: "RepositoryError", operation, cause });
}

function mergeProgressEntries(entries: readonly ProgressEntryType[]): readonly ProgressEntryType[] {
	const merged = entries.reduce<Map<string, ProgressEntryType>>((result, entry) => {
		const current = result.get(entry.questionId);
		if (!current) {
			result.set(entry.questionId, entry);
		} else if (entry.updatedAt > current.updatedAt) {
			result.set(entry.questionId, {
				...entry,
				createdAt: Math.min(entry.createdAt, current.createdAt) as ProgressEntryType["createdAt"],
			});
		} else if (entry.updatedAt === current.updatedAt && entry.createdAt < current.createdAt) {
			result.set(entry.questionId, { ...current, createdAt: entry.createdAt });
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

export function createSyncLink(
	db: Db,
	syncLinkId: SyncLinkId,
	createdAt: number,
): ResultAsync<void, ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.insert(syncLinks)
			.values({ id: syncLinkId, createdAt })
			.then(() => undefined),
		repositoryError("CreateSyncLink"),
	);
}

function writeProgress(
	db: Db,
	syncLinkId: SyncLinkId,
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
						.values({ syncLinkId, ...entry })
						.onConflictDoUpdate({
							target: [questionProgress.syncLinkId, questionProgress.questionId],
							set: {
								unitId: sql`CASE WHEN excluded.updated_at >= ${questionProgress.updatedAt} THEN excluded.unit_id ELSE ${questionProgress.unitId} END`,
								createdAt: sql`MIN(${questionProgress.createdAt}, excluded.created_at)`,
								updatedAt: sql`MAX(${questionProgress.updatedAt}, excluded.updated_at)`,
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
	syncLinkId: SyncLinkId,
): ResultAsync<readonly ProgressEntryType[], ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.select({
				questionId: questionProgress.questionId,
				unitId: questionProgress.unitId,
				createdAt: questionProgress.createdAt,
				updatedAt: questionProgress.updatedAt,
			})
			.from(questionProgress)
			.where(eq(questionProgress.syncLinkId, syncLinkId))
			.orderBy(desc(questionProgress.updatedAt)),
		repositoryError("ReadProgress"),
	).andThen((rows) =>
		ProgressEntry.parseList(rows).mapErr(
			(validationError): ProgressRepositoryError => ({
				kind: "InvalidStoredProgress",
				syncLinkId,
				issues: validationError.issues,
			}),
		),
	);
}

export function syncProgress(
	db: Db,
	syncLinkId: SyncLinkId,
	entries: readonly ProgressEntryType[],
): ResultAsync<readonly ProgressEntryType[], ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db.select({ id: syncLinks.id }).from(syncLinks).where(eq(syncLinks.id, syncLinkId)).limit(1),
		repositoryError("FindSyncLink"),
	).andThen(([link]) =>
		link
			? writeProgress(db, syncLinkId, entries).andThen(() => readProgress(db, syncLinkId))
			: errAsync<readonly ProgressEntryType[], ProgressRepositoryError>({
					kind: "SyncLinkNotFound",
					syncLinkId,
				}),
	);
}

export function deleteSyncLink(
	db: Db,
	syncLinkId: SyncLinkId,
): ResultAsync<void, ProgressRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.delete(syncLinks)
			.where(eq(syncLinks.id, syncLinkId))
			.then(() => undefined),
		repositoryError("DeleteSyncLink"),
	);
}
