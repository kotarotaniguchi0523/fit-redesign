import { desc, eq, inArray } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { CompletedChallengePayload } from "../features/challenge/types";
import {
	ChallengeIdSchema,
	EpochMillisecondsSchema,
	ExamIdSchema,
	JudgmentSchema,
	QuestionIdSchema,
} from "../types/browser";
import { answers, challenges, type Db, syncLinks } from "./schema";
import { SyncLinkId, type SyncLinkId as SyncLinkIdType } from "./syncLinkId";

type ChallengeRepositoryOperation =
	| "FindSyncLink"
	| "ReadChallenge"
	| "ReadChallenges"
	| "WriteChallenges";

export type ChallengeRepositoryError =
	| Readonly<{ kind: "RepositoryError"; operation: ChallengeRepositoryOperation; cause: unknown }>
	| Readonly<{ kind: "SyncLinkNotFound"; syncLinkId: SyncLinkIdType }>
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
		challengeId: ChallengeIdSchema.parse(challenge.id),
		examId: ExamIdSchema.parse(challenge.examId),
		createdAt: EpochMillisecondsSchema.parse(challenge.createdAt),
		updatedAt: EpochMillisecondsSchema.parse(challenge.updatedAt),
		answers: challengeAnswers.map((answer) => ({
			questionId: QuestionIdSchema.parse(answer.questionId),
			elapsedMs: answer.elapsedMs,
			judgment: JudgmentSchema.parse(answer.judgment),
			createdAt: EpochMillisecondsSchema.parse(answer.createdAt),
			updatedAt: EpochMillisecondsSchema.parse(answer.updatedAt),
		})),
	};
}

type StoredChallenge = Readonly<{
	payload: CompletedChallengePayload;
	syncLinkId: string;
}>;

function readChallenges(
	db: Db,
	syncLinkId: SyncLinkIdType,
): ResultAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError> {
	return ResultAsync.fromPromise(
		db
			.select()
			.from(challenges)
			.where(eq(challenges.syncLinkId, syncLinkId))
			.orderBy(desc(challenges.updatedAt))
			.then(async (challengeRows) => {
				const groupedAnswers = new Map<string, (typeof answers.$inferSelect)[]>();
				for (let offset = 0; offset < challengeRows.length; offset += 75) {
					const batch = challengeRows.slice(offset, offset + 75);
					const ids = batch.map((challenge) => challenge.id);
					const rows = await db.select().from(answers).where(inArray(answers.challengeId, ids));
					for (const answer of rows) {
						const grouped = groupedAnswers.get(answer.challengeId) ?? [];
						grouped.push(answer);
						groupedAnswers.set(answer.challengeId, grouped);
					}
				}
				return challengeRows.map((challenge) =>
					toPayload(challenge, groupedAnswers.get(challenge.id) ?? []),
				);
			}),
		repositoryError("ReadChallenges"),
	);
}

export function syncChallenges(
	db: Db,
	syncLinkId: SyncLinkIdType,
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
		const submitted = [...uniquePayloads.values()];
		return ResultAsync.fromPromise(
			Promise.all(
				Array.from({ length: Math.ceil(submitted.length / 75) }, async (_, index) => {
					const batch = submitted.slice(index * 75, (index + 1) * 75);
					const rows = await db
						.select({ challenge: challenges, syncLinkId: challenges.syncLinkId })
						.from(challenges)
						.where(
							inArray(
								challenges.id,
								batch.map((payload) => ChallengeIdSchema.parse(payload.challengeId)),
							),
						);
					const answerRows = await db
						.select()
						.from(answers)
						.where(
							inArray(
								answers.challengeId,
								batch.map((payload) => ChallengeIdSchema.parse(payload.challengeId)),
							),
						);
					return { rows, answerRows };
				}),
			),
			repositoryError("ReadChallenge"),
		).andThen((batches) => {
			const existing = new Map<string, StoredChallenge>();
			for (const { rows, answerRows } of batches) {
				const answersByChallenge = new Map<string, (typeof answers.$inferSelect)[]>();
				for (const answer of answerRows) {
					const group = answersByChallenge.get(answer.challengeId) ?? [];
					group.push(answer);
					answersByChallenge.set(answer.challengeId, group);
				}
				for (const row of rows) {
					existing.set(row.challenge.id, {
						payload: toPayload(row.challenge, answersByChallenge.get(row.challenge.id) ?? []),
						syncLinkId: row.syncLinkId,
					});
				}
			}
			return submitted
				.reduce<ResultAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>>(
					(result, payload) =>
						result.andThen((newPayloads) => {
							const stored = existing.get(payload.challengeId);
							if (stored) {
								return stored.syncLinkId === syncLinkId &&
									canonicalPayload(stored.payload) === canonicalPayload(payload) &&
									stored.payload.answers.length === payload.answers.length
									? okAsync(newPayloads)
									: errAsync<readonly CompletedChallengePayload[], ChallengeRepositoryError>({
											kind: "ChallengeConflict",
											challengeId: payload.challengeId,
										});
							}
							return okAsync([...newPayloads, payload]);
						}),
					okAsync<readonly CompletedChallengePayload[]>([]),
				)
				.andThen((newPayloads) => {
					if (newPayloads.length === 0) {
						return readChallenges(db, syncLinkId);
					}
					const statements = newPayloads.flatMap((payload) => {
						const challenge: typeof challenges.$inferInsert = {
							id: ChallengeIdSchema.parse(payload.challengeId),
							syncLinkId: SyncLinkId.schema.parse(syncLinkId),
							examId: ExamIdSchema.parse(payload.examId),
							createdAt: payload.createdAt,
							updatedAt: payload.updatedAt,
						};
						return [
							db.insert(challenges).values(challenge),
							db.insert(answers).values(
								payload.answers.map((answer) => ({
									challengeId: ChallengeIdSchema.parse(payload.challengeId),
									questionId: QuestionIdSchema.parse(answer.questionId),
									elapsedMs: answer.elapsedMs,
									judgment: answer.judgment,
									createdAt: answer.createdAt,
									updatedAt: answer.updatedAt,
								})),
							),
						];
					});
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
	});
}
