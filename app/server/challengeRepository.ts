import { desc, eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { CompletedChallengePayload } from "../features/challenge/types";
import type { QuestionId } from "../types";
import { answers, challenges, type Db, syncLinks } from "./schema";
import type { SyncLinkId } from "./syncLinkId";

type ChallengeRepositoryOperation =
	| "FindSyncLink"
	| "ReadChallenge"
	| "ReadChallenges"
	| "WriteChallenges";

export type ChallengeRepositoryError =
	| Readonly<{ kind: "RepositoryError"; operation: ChallengeRepositoryOperation; cause: unknown }>
	| Readonly<{ kind: "SyncLinkNotFound"; syncLinkId: SyncLinkId }>
	| Readonly<{ kind: "ChallengeConflict"; challengeId: string }>;

export const ChallengeRepositoryError = {
	isUnknownLink: (error: ChallengeRepositoryError): boolean => error.kind === "SyncLinkNotFound",
	isConflict: (error: ChallengeRepositoryError): boolean => error.kind === "ChallengeConflict",
} as const;

function repositoryError(
	operation: ChallengeRepositoryOperation,
): (cause: unknown) => ChallengeRepositoryError {
	return (cause): ChallengeRepositoryError => ({ kind: "RepositoryError", operation, cause });
}

function canonicalPayload(payload: CompletedChallengePayload): string {
	return JSON.stringify({
		challengeId: payload.challengeId,
		examId: payload.examId,
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt,
		answers: [...payload.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
	});
}

function toPayload(
	challenge: typeof challenges.$inferSelect,
	challengeAnswers: readonly (typeof answers.$inferSelect)[],
): CompletedChallengePayload {
	return {
		challengeId: challenge.id,
		examId: challenge.examId,
		createdAt: challenge.createdAt,
		updatedAt: challenge.updatedAt,
		answers: challengeAnswers.map((answer) => ({
			questionId: answer.questionId as QuestionId,
			elapsedMs: answer.elapsedMs,
			judgment: answer.judgment as "correct" | "incorrect",
			createdAt: answer.createdAt,
			updatedAt: answer.updatedAt,
		})),
	};
}

type StoredChallenge = Readonly<{
	payload: CompletedChallengePayload;
	syncLinkId: string;
}>;

function readChallenge(
	db: Db,
	challengeId: string,
): ResultAsync<StoredChallenge | undefined, ChallengeRepositoryError> {
	return ResultAsync.fromPromise(
		Promise.all([
			db
				.select({
					challenge: challenges,
					syncLinkId: challenges.syncLinkId,
				})
				.from(challenges)
				.where(eq(challenges.id, challengeId))
				.limit(1),
			db.select().from(answers).where(eq(answers.challengeId, challengeId)),
		]),
		repositoryError("ReadChallenge"),
	).map(([challengeRows, answerRows]) => {
		const row = challengeRows[0];
		return row
			? { payload: toPayload(row.challenge, answerRows), syncLinkId: row.syncLinkId }
			: undefined;
	});
}

function readChallenges(
	db: Db,
	syncLinkId: SyncLinkId,
): ResultAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.select()
			.from(challenges)
			.where(eq(challenges.syncLinkId, syncLinkId))
			.orderBy(desc(challenges.updatedAt))
			.then(async (challengeRows) =>
				Promise.all(
					challengeRows.map(async (challenge) => {
						const challengeAnswers = await db
							.select()
							.from(answers)
							.where(eq(answers.challengeId, challenge.id));
						return toPayload(challenge, challengeAnswers);
					}),
				),
			),
		repositoryError("ReadChallenges"),
	);
}

export function syncChallenges(
	db: Db,
	syncLinkId: SyncLinkId,
	payloads: readonly CompletedChallengePayload[],
): ResultAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError> {
	return ResultAsync.fromPromise(
		db.select({ id: syncLinks.id }).from(syncLinks).where(eq(syncLinks.id, syncLinkId)).limit(1),
		repositoryError("FindSyncLink"),
	).andThen(([link]) => {
		if (!link) {
			return errAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>({
				kind: "SyncLinkNotFound",
				syncLinkId,
			});
		}

		const uniquePayloads = new Map<string, CompletedChallengePayload>();
		for (const payload of payloads) {
			const current = uniquePayloads.get(payload.challengeId);
			if (current && canonicalPayload(current) !== canonicalPayload(payload)) {
				return errAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>({
					kind: "ChallengeConflict",
					challengeId: payload.challengeId,
				});
			}
			uniquePayloads.set(payload.challengeId, payload);
		}
		return [...uniquePayloads.values()]
			.reduce<ResultAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>>(
				(result, payload) =>
					result.andThen((newPayloads) =>
						readChallenge(db, payload.challengeId).andThen((existing) => {
							if (existing) {
								return existing.syncLinkId === syncLinkId &&
									canonicalPayload(existing.payload) === canonicalPayload(payload) &&
									existing.payload.answers.length === payload.answers.length
									? okAsync(newPayloads)
									: errAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>({
											kind: "ChallengeConflict",
											challengeId: payload.challengeId,
										});
							}
							return okAsync([...newPayloads, payload]);
						}),
					),
				okAsync<readonly CompletedChallengePayload[]>([]),
			)
			.andThen((newPayloads) => {
				if (newPayloads.length === 0) {
					return readChallenges(db, syncLinkId);
				}
				const statements = newPayloads.flatMap((payload) => [
					db.insert(challenges).values({
						id: payload.challengeId,
						syncLinkId,
						examId: payload.examId,
						createdAt: payload.createdAt,
						updatedAt: payload.updatedAt,
					}),
					db.insert(answers).values(
						payload.answers.map((answer) => ({
							challengeId: payload.challengeId,
							questionId: answer.questionId,
							elapsedMs: answer.elapsedMs,
							judgment: answer.judgment,
							createdAt: answer.createdAt,
							updatedAt: answer.updatedAt,
						})),
					),
				]);
				const [first, ...rest] = statements;
				if (!first) {
					return readChallenges(db, syncLinkId);
				}
				return ResultAsync.fromPromise(
					db.batch([first, ...rest]).then(() => undefined),
					repositoryError("WriteChallenges"),
				).andThen(() => readChallenges(db, syncLinkId));
			});
	});
}
