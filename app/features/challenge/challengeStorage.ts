import type { Judgment, QuestionId } from "../../types";
import {
	ChallengeIdSchema,
	ExamIdSchema,
	JudgmentSchema,
	QuestionIdSchema,
} from "../../types/browser";
import {
	createChallengeSnapshot,
	mergeCompletedChallenges,
	restoreChallengeState,
	toCompletedChallengePayload,
} from "./challenge";
import type { ChallengeSnapshot, ChallengeState, CompletedChallengePayload } from "./types";

export const ACTIVE_CHALLENGES_STORAGE_KEY = "fit-challenge-active-v1";
export const CHALLENGE_HISTORY_STORAGE_KEY = "fit-challenge-history-v1";
export const CHALLENGE_LOCKS_STORAGE_KEY = "fit-challenge-locks-v1";
const CHALLENGE_CHANGE_EVENT = "fit:challenge-change";
const CHALLENGE_LOCK_TTL_MS = 15_000;

type ChallengeLock = Readonly<{ ownerId: string; heartbeatAt: number }>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJudgment(value: unknown): value is Judgment {
	return JudgmentSchema.safeParse(value).success;
}

function isQuestionId(value: unknown): value is QuestionId {
	return QuestionIdSchema.safeParse(value).success;
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isEpochMilliseconds(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isChallengeLock(value: unknown): value is ChallengeLock {
	return isRecord(value) && typeof value.ownerId === "string" && isNumber(value.heartbeatAt);
}

function isSnapshot(value: unknown): value is ChallengeSnapshot {
	if (!isRecord(value)) {
		return false;
	}
	const raw = value;
	const createdAt = raw.createdAt;
	const updatedAt = raw.updatedAt;
	const questionIds = raw.questionIds;
	const revealedQuestionIds = raw.revealedQuestionIds;
	const judgments = raw.judgments;
	const answerCreatedAt = raw.answerCreatedAt;
	const questionElapsedMs = raw.questionElapsedMs;
	if (
		raw.version !== 1 ||
		!ChallengeIdSchema.safeParse(raw.challengeId).success ||
		typeof raw.scopeKey !== "string" ||
		!ExamIdSchema.safeParse(raw.examId).success ||
		(raw.mode !== "exam" && raw.mode !== "question") ||
		!Array.isArray(questionIds) ||
		questionIds.length === 0 ||
		!questionIds.every(isQuestionId) ||
		!isEpochMilliseconds(createdAt) ||
		(updatedAt !== null && !isEpochMilliseconds(updatedAt)) ||
		typeof raw.currentIndex !== "number" ||
		!Number.isInteger(raw.currentIndex) ||
		raw.currentIndex < 0 ||
		raw.currentIndex >= questionIds.length ||
		!Array.isArray(revealedQuestionIds) ||
		!revealedQuestionIds.every(isQuestionId) ||
		(raw.status !== "active" && raw.status !== "incomplete" && raw.status !== "completed") ||
		!isRecord(judgments) ||
		!isRecord(answerCreatedAt) ||
		!isRecord(questionElapsedMs)
	) {
		return false;
	}
	const questionSet = new Set<string>(questionIds);
	return (
		Object.entries(judgments).every(
			([questionId, judgment]) => questionSet.has(questionId) && isJudgment(judgment),
		) &&
		Object.entries(answerCreatedAt).every(
			([questionId, timestamp]) =>
				questionSet.has(questionId) && isEpochMilliseconds(timestamp) && timestamp >= createdAt,
		) &&
		Object.entries(questionElapsedMs).every(
			([questionId, elapsedMs]) =>
				questionSet.has(questionId) && isNumber(elapsedMs) && elapsedMs >= 0,
		) &&
		Object.keys(judgments).length === Object.keys(answerCreatedAt).length &&
		Object.keys(judgments).every((id) => Object.hasOwn(answerCreatedAt, id)) &&
		Object.keys(judgments).every((id) =>
			revealedQuestionIds.some((questionId) => questionId === id),
		) &&
		new Set(questionIds).size === questionIds.length &&
		new Set(revealedQuestionIds).size === revealedQuestionIds.length &&
		revealedQuestionIds.every((id) => questionSet.has(id)) &&
		(raw.status === "completed") === (updatedAt !== null) &&
		(updatedAt === null || updatedAt >= createdAt) &&
		(raw.status !== "completed" || Object.keys(judgments).length === questionIds.length)
	);
}

function notifyChallengeChange(): void {
	window.dispatchEvent(new Event(CHALLENGE_CHANGE_EVENT));
}

export function subscribeToChallenges(onStoreChange: () => void): () => void {
	const onStorage = (event: StorageEvent): void => {
		if (
			event.key === ACTIVE_CHALLENGES_STORAGE_KEY ||
			event.key === CHALLENGE_HISTORY_STORAGE_KEY
		) {
			onStoreChange();
		}
	};
	window.addEventListener("storage", onStorage);
	window.addEventListener(CHALLENGE_CHANGE_EVENT, onStoreChange);
	return (): void => {
		window.removeEventListener("storage", onStorage);
		window.removeEventListener(CHALLENGE_CHANGE_EVENT, onStoreChange);
	};
}

function readJson(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? "null");
	} catch {
		return null;
	}
}

function writeJson(key: string, value: unknown): boolean {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		notifyChallengeChange();
		return true;
	} catch {
		return false;
	}
}

function readChallengeLocks(): Readonly<Record<string, ChallengeLock>> {
	const parsed = readJson(CHALLENGE_LOCKS_STORAGE_KEY);
	if (!isRecord(parsed)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(parsed).flatMap(([challengeId, lock]) =>
			isChallengeLock(lock) ? [[challengeId, lock] as const] : [],
		),
	);
}

function writeChallengeLocks(locks: Readonly<Record<string, ChallengeLock>>): boolean {
	return writeJson(CHALLENGE_LOCKS_STORAGE_KEY, locks);
}

export function tryAcquireChallengeLock(challengeId: string, ownerId: string): boolean {
	const locks = { ...readChallengeLocks() };
	const current = locks[challengeId];
	const now = Date.now();
	if (current && current.ownerId !== ownerId && now - current.heartbeatAt < CHALLENGE_LOCK_TTL_MS) {
		return false;
	}
	locks[challengeId] = { ownerId, heartbeatAt: now };
	return writeChallengeLocks(locks);
}

export function renewChallengeLock(challengeId: string, ownerId: string): boolean {
	const locks = { ...readChallengeLocks() };
	if (locks[challengeId]?.ownerId !== ownerId) {
		return false;
	}
	locks[challengeId] = { ownerId, heartbeatAt: Date.now() };
	return writeChallengeLocks(locks);
}

export function releaseChallengeLock(challengeId: string, ownerId: string): boolean {
	const locks = { ...readChallengeLocks() };
	if (locks[challengeId]?.ownerId !== ownerId) {
		return true;
	}
	delete locks[challengeId];
	return writeChallengeLocks(locks);
}

export function hasActiveChallengeLock(challengeId: string, ownerId: string): boolean {
	const lock = readChallengeLocks()[challengeId];
	return Boolean(
		lock && lock.ownerId !== ownerId && Date.now() - lock.heartbeatAt < CHALLENGE_LOCK_TTL_MS,
	);
}

export function readActiveChallenges(): Readonly<Record<string, ChallengeSnapshot>> {
	const parsed = readJson(ACTIVE_CHALLENGES_STORAGE_KEY);
	if (!isRecord(parsed)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(parsed).flatMap(([challengeId, snapshot]) => {
			if (
				!isSnapshot(snapshot) ||
				snapshot.challengeId !== challengeId ||
				snapshot.status !== "active"
			) {
				return [];
			}
			return [[challengeId, snapshot] as const];
		}),
	);
}

export function readChallengeHistory(): readonly ChallengeSnapshot[] {
	const parsed = readJson(CHALLENGE_HISTORY_STORAGE_KEY);
	if (!Array.isArray(parsed)) {
		return [];
	}
	return parsed.filter(isSnapshot).filter((snapshot) => snapshot.status !== "active");
}

export function readChallengeHistorySnapshot(): string | null {
	try {
		return localStorage.getItem(CHALLENGE_HISTORY_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function findActiveChallenge(scopeKey: string): ChallengeSnapshot | undefined {
	return Object.values(readActiveChallenges()).find((snapshot) => snapshot.scopeKey === scopeKey);
}

export function findChallenge(challengeId: string): ChallengeSnapshot | undefined {
	return (
		readActiveChallenges()[challengeId] ??
		readChallengeHistory().find((snapshot) => snapshot.challengeId === challengeId)
	);
}

export function saveActiveChallenge(state: ChallengeState): boolean {
	const active = { ...readActiveChallenges(), [state.challengeId]: createChallengeSnapshot(state) };
	return writeJson(ACTIVE_CHALLENGES_STORAGE_KEY, active);
}

function writeHistory(history: readonly ChallengeSnapshot[]): boolean {
	return writeJson(CHALLENGE_HISTORY_STORAGE_KEY, history);
}

function removeActiveChallenge(challengeId: string): Readonly<Record<string, ChallengeSnapshot>> {
	const active = { ...readActiveChallenges() };
	delete active[challengeId];
	return active;
}

export function archiveChallenge(state: ChallengeState): boolean {
	const snapshot = createChallengeSnapshot(state);
	const history = [
		snapshot,
		...readChallengeHistory().filter((item) => item.challengeId !== state.challengeId),
	];
	const activeSaved = writeJson(
		ACTIVE_CHALLENGES_STORAGE_KEY,
		removeActiveChallenge(state.challengeId),
	);
	const historySaved = writeHistory(history);
	return activeSaved && historySaved;
}

export function markActiveChallengeIncomplete(state: ChallengeState): boolean {
	return state.status === "active" && archiveChallenge({ ...state, status: "incomplete" });
}

export function discardActiveChallenge(challengeId: string): boolean {
	return writeJson(ACTIVE_CHALLENGES_STORAGE_KEY, removeActiveChallenge(challengeId));
}

function snapshotFromCompletedChallenge(payload: CompletedChallengePayload): ChallengeSnapshot {
	const questionIds = payload.answers.map((answer) => answer.questionId);
	return {
		version: 1,
		challengeId: payload.challengeId,
		scopeKey: `${payload.examId}/${questionIds.length === 1 ? `question/${questionIds[0]}` : "exam"}`,
		examId: ExamIdSchema.parse(payload.examId),
		mode: questionIds.length === 1 ? "question" : "exam",
		questionIds,
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt,
		currentIndex: Math.max(questionIds.length - 1, 0),
		revealedQuestionIds: questionIds,
		judgments: Object.fromEntries(
			payload.answers.map((answer) => [answer.questionId, answer.judgment]),
		),
		answerCreatedAt: Object.fromEntries(
			payload.answers.map((answer) => [answer.questionId, answer.createdAt]),
		),
		questionElapsedMs: Object.fromEntries(
			payload.answers.map((answer) => [answer.questionId, answer.elapsedMs]),
		),
		status: "completed",
	};
}

export function readCompletedChallenges(): readonly CompletedChallengePayload[] {
	return readChallengeHistory().flatMap((snapshot) => {
		if (snapshot.status !== "completed") {
			return [];
		}
		const payload = toCompletedChallengePayload(
			restoreChallengeState(snapshot),
			snapshot.updatedAt,
		);
		return payload ? [payload] : [];
	});
}

export function archiveCompletedChallenge(
	state: ChallengeState,
	updatedAt: number,
): Readonly<{ payload: CompletedChallengePayload; persisted: boolean }> | null {
	if (state.status !== "active") {
		return null;
	}
	const completed = { ...state, status: "completed" as const, updatedAt };
	const payload = toCompletedChallengePayload(completed, updatedAt);
	if (!payload) {
		return null;
	}
	return { payload, persisted: archiveChallenge(completed) };
}

export function mergeCompletedChallengeHistory(
	remote: readonly CompletedChallengePayload[],
): readonly CompletedChallengePayload[] {
	const merged = mergeCompletedChallenges(readCompletedChallenges(), remote);
	const incomplete = readChallengeHistory().filter((snapshot) => snapshot.status === "incomplete");
	writeHistory([
		...merged.map(snapshotFromCompletedChallenge).map((snapshot) => ({ ...snapshot })),
		...incomplete,
	]);
	return merged;
}

export function createChallengeStateFromSnapshot(snapshot: ChallengeSnapshot): ChallengeState {
	return restoreChallengeState(snapshot);
}
