import { eq, inList } from "remix/data-table";
import type { CompletedChallengePayload } from "../features/challenge/types.ts";
import { mergeLatestProgressEntries } from "../lib/progress.ts";
import { sortByQuestionId } from "../lib/questionOrder.ts";
import type { SyncLinkId } from "../lib/syncLinkId.ts";
import {
	ChallengeIdSchema,
	EpochMillisecondsSchema,
	ExamIdSchema,
	JudgmentSchema,
	type ProgressEntry,
	ProgressEntryListSchema,
	QuestionIdSchema,
} from "../types/index.ts";
import type { AppDatabase } from "./registry.ts";
import { answers, challenges, questionProgress, syncLinks } from "./tables.ts";

/**
 * 学習記録の同期リポジトリ。`remix/data-table` の query API で D1 を操作する。
 * 旧 Drizzle 実装（`legacy/server/*Repository.ts`）と同じ振る舞いを保つ。
 */

export class SyncLinkNotFoundError extends Error {
	readonly kind = "SyncLinkNotFound";
	constructor() {
		super("sync link not found");
	}
}

export class ChallengeConflictError extends Error {
	readonly kind = "ChallengeConflict";
	readonly challengeId: string;
	constructor(challengeId: string) {
		super(`challenge conflict: ${challengeId}`);
		this.challengeId = challengeId;
	}
}

type ProgressRow = {
	question_id: string;
	unit_id: string;
	created_at: number;
	updated_at: number;
};

function toProgressEntry(row: ProgressRow): ProgressEntry {
	return {
		questionId: QuestionIdSchema.parse(row.question_id),
		unitId: row.unit_id as ProgressEntry["unitId"],
		createdAt: EpochMillisecondsSchema.parse(row.created_at),
		updatedAt: EpochMillisecondsSchema.parse(row.updated_at),
	};
}

export async function createSyncLink(
	db: AppDatabase,
	syncLinkId: SyncLinkId,
	createdAt: number,
): Promise<void> {
	await db.query(syncLinks).insert({ id: syncLinkId, created_at: createdAt });
}

export async function findSyncLink(db: AppDatabase, syncLinkId: SyncLinkId): Promise<boolean> {
	const link = await db.query(syncLinks).where(eq(syncLinks.id, syncLinkId)).first();
	return link !== null;
}

export async function deleteSyncLink(db: AppDatabase, syncLinkId: SyncLinkId): Promise<void> {
	await db.query(syncLinks).where(eq(syncLinks.id, syncLinkId)).delete();
}

async function readProgress(db: AppDatabase, syncLinkId: SyncLinkId): Promise<ProgressEntry[]> {
	const rows = (await db
		.query(questionProgress)
		.where(eq(questionProgress.sync_link_id, syncLinkId))
		.orderBy(questionProgress.updated_at, "desc")
		.all()) as ProgressRow[];

	return ProgressEntryListSchema.parse(rows.map(toProgressEntry)) as unknown as ProgressEntry[];
}

/**
 * 既存行と受信エントリを「updatedAt が最新・createdAt が最古」でマージする。
 * 旧実装の `ON CONFLICT ... MIN(created_at) / MAX(updated_at)` と同じ意味論。
 */
function mergeWithExisting(
	existing: readonly ProgressEntry[],
	incoming: readonly ProgressEntry[],
): ProgressEntry[] {
	const byQuestion = new Map<string, ProgressEntry>();

	for (const entry of existing) {
		byQuestion.set(entry.questionId, entry);
	}

	for (const merged of mergeLatestProgressEntries(incoming)) {
		const stored = byQuestion.get(merged.questionId);
		byQuestion.set(
			merged.questionId,
			stored
				? {
						...merged,
						createdAt: EpochMillisecondsSchema.parse(Math.min(stored.createdAt, merged.createdAt)),
						updatedAt: EpochMillisecondsSchema.parse(Math.max(stored.updatedAt, merged.updatedAt)),
						unitId: merged.updatedAt >= stored.updatedAt ? merged.unitId : stored.unitId,
					}
				: merged,
		);
	}

	return [...byQuestion.values()];
}

export async function syncProgress(
	db: AppDatabase,
	syncLinkId: SyncLinkId,
	entries: readonly ProgressEntry[],
): Promise<ProgressEntry[]> {
	if (!(await findSyncLink(db, syncLinkId))) {
		throw new SyncLinkNotFoundError();
	}

	const existing = await readProgress(db, syncLinkId);
	const merged = mergeWithExisting(existing, entries);

	await db.transaction(async (tx) => {
		for (const entry of merged) {
			await tx.query(questionProgress).upsert(
				{
					sync_link_id: syncLinkId,
					question_id: entry.questionId,
					unit_id: entry.unitId,
					created_at: entry.createdAt,
					updated_at: entry.updatedAt,
				},
				{
					conflictTarget: ["sync_link_id", "question_id"],
					update: {
						unit_id: entry.unitId,
						created_at: entry.createdAt,
						updated_at: entry.updatedAt,
					},
				},
			);
		}
	});

	return readProgress(db, syncLinkId);
}

function canonicalPayload(payload: CompletedChallengePayload): string {
	return JSON.stringify({
		challengeId: payload.challengeId,
		examId: payload.examId,
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt,
		answers: sortByQuestionId(payload.answers),
	});
}

async function readChallenges(
	db: AppDatabase,
	syncLinkId: SyncLinkId,
): Promise<CompletedChallengePayload[]> {
	const challengeRows = (await db
		.query(challenges)
		.where(eq(challenges.sync_link_id, syncLinkId))
		.orderBy(challenges.updated_at, "desc")
		.all()) as Array<{
		id: string;
		exam_id: string;
		created_at: number;
		updated_at: number;
	}>;

	if (challengeRows.length === 0) {
		return [];
	}

	const ids = challengeRows.map((row) => row.id);
	const answerRows = (await db
		.query(answers)
		.where(inList(answers.challenge_id, ids))
		.all()) as Array<{
		challenge_id: string;
		question_id: string;
		elapsed_ms: number;
		judgment: string;
		created_at: number;
		updated_at: number;
	}>;

	const byChallenge = new Map<string, typeof answerRows>();
	for (const answer of answerRows) {
		const group = byChallenge.get(answer.challenge_id) ?? [];
		group.push(answer);
		byChallenge.set(answer.challenge_id, group);
	}

	return challengeRows.map((challenge) => ({
		challengeId: ChallengeIdSchema.parse(challenge.id),
		examId: challenge.exam_id,
		createdAt: EpochMillisecondsSchema.parse(challenge.created_at),
		updatedAt: EpochMillisecondsSchema.parse(challenge.updated_at),
		answers: (byChallenge.get(challenge.id) ?? []).map((answer) => ({
			questionId: QuestionIdSchema.parse(answer.question_id),
			elapsedMs: answer.elapsed_ms,
			judgment: JudgmentSchema.parse(answer.judgment),
			createdAt: EpochMillisecondsSchema.parse(answer.created_at),
			updatedAt: EpochMillisecondsSchema.parse(answer.updated_at),
		})),
	}));
}

export async function syncChallenges(
	db: AppDatabase,
	syncLinkId: SyncLinkId,
	payloads: readonly CompletedChallengePayload[],
): Promise<CompletedChallengePayload[]> {
	if (!(await findSyncLink(db, syncLinkId))) {
		throw new SyncLinkNotFoundError();
	}

	const unique = new Map<string, CompletedChallengePayload>();
	for (const payload of payloads) {
		const current = unique.get(payload.challengeId);
		if (current && canonicalPayload(current) !== canonicalPayload(payload)) {
			throw new ChallengeConflictError(payload.challengeId);
		}
		unique.set(payload.challengeId, payload);
	}

	const ids = [...unique.keys()];
	const existingRows =
		ids.length > 0
			? ((await db.query(challenges).where(inList(challenges.id, ids)).all()) as Array<{
					id: string;
					sync_link_id: string;
					exam_id: string;
					created_at: number;
					updated_at: number;
				}>)
			: [];
	const existingByChallenge = new Map(existingRows.map((row) => [row.id, row]));

	const toInsert: CompletedChallengePayload[] = [];
	for (const payload of unique.values()) {
		const existing = existingByChallenge.get(payload.challengeId);
		if (existing) {
			const storedAnswers = (await db
				.query(answers)
				.where(eq(answers.challenge_id, payload.challengeId))
				.all()) as Array<{
				question_id: string;
				elapsed_ms: number;
				judgment: string;
				created_at: number;
				updated_at: number;
			}>;
			const stored: CompletedChallengePayload = {
				challengeId: ChallengeIdSchema.parse(existing.id),
				examId: existing.exam_id,
				createdAt: EpochMillisecondsSchema.parse(existing.created_at),
				updatedAt: EpochMillisecondsSchema.parse(existing.updated_at),
				answers: storedAnswers.map((answer) => ({
					questionId: QuestionIdSchema.parse(answer.question_id),
					elapsedMs: answer.elapsed_ms,
					judgment: JudgmentSchema.parse(answer.judgment),
					createdAt: EpochMillisecondsSchema.parse(answer.created_at),
					updatedAt: EpochMillisecondsSchema.parse(answer.updated_at),
				})),
			};
			if (
				existing.sync_link_id !== syncLinkId ||
				canonicalPayload(stored) !== canonicalPayload(payload)
			) {
				throw new ChallengeConflictError(payload.challengeId);
			}
			continue;
		}
		toInsert.push(payload);
	}

	if (toInsert.length > 0) {
		await db.transaction(async (tx) => {
			for (const payload of toInsert) {
				await tx.query(challenges).insert({
					id: ChallengeIdSchema.parse(payload.challengeId),
					sync_link_id: syncLinkId,
					exam_id: ExamIdSchema.parse(payload.examId),
					created_at: payload.createdAt,
					updated_at: payload.updatedAt,
				});
				for (const answer of payload.answers) {
					await tx.query(answers).insert({
						challenge_id: ChallengeIdSchema.parse(payload.challengeId),
						question_id: QuestionIdSchema.parse(answer.questionId),
						elapsed_ms: answer.elapsedMs,
						judgment: JudgmentSchema.parse(answer.judgment),
						created_at: answer.createdAt,
						updated_at: answer.updatedAt,
					});
				}
			}
		});
	}

	return readChallenges(db, syncLinkId);
}
