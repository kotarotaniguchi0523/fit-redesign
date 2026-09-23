import type { ExamId, Judgment, QuestionId } from "../../types";
import type {
	ChallengeId,
	ChallengeResultSummary,
	ChallengeSnapshot,
	ChallengeState,
	CompletedChallengePayload,
	QuestionResultSummary,
} from "./types";

export const MAX_REASONABLE_TIMER_DELTA_MS = 24 * 60 * 60 * 1000;

export type TimerRuntime = Readonly<{
	running: boolean;
	lastSample: number | null;
	currentQuestionId: QuestionId;
}>;

export type ChallengeAction =
	| Readonly<{ type: "REVEAL_QUESTION"; questionId: QuestionId }>
	| Readonly<{
			type: "JUDGE_QUESTION";
			questionId: QuestionId;
			judgment: Judgment;
			answerCreatedAt: number;
	  }>
	| Readonly<{ type: "APPLY_ELAPSED"; questionId: QuestionId; deltaMs: number }>
	| Readonly<{ type: "MOVE_TO"; index: number }>
	| Readonly<{ type: "COMPLETE"; updatedAt: number }>
	| Readonly<{ type: "MARK_INCOMPLETE" }>;

export function calculateElapsedDelta(runtime: TimerRuntime, now: number): number {
	if (!runtime.running || runtime.lastSample === null) {
		return 0;
	}
	const delta = now - runtime.lastSample;
	if (!Number.isFinite(delta) || delta < 0 || delta > MAX_REASONABLE_TIMER_DELTA_MS) {
		return 0;
	}
	return delta;
}

export function createInitialChallengeState(input: {
	challengeId: ChallengeId;
	scopeKey: string;
	examId: ExamId;
	mode: "exam" | "question";
	questionIds: readonly QuestionId[];
	createdAt: number;
	initialIndex?: number;
}): ChallengeState {
	const maxIndex = Math.max(input.questionIds.length - 1, 0);
	return {
		version: 1,
		challengeId: input.challengeId,
		scopeKey: input.scopeKey,
		examId: input.examId,
		mode: input.mode,
		questionIds: [...input.questionIds],
		createdAt: input.createdAt,
		updatedAt: null,
		currentIndex: Math.min(Math.max(input.initialIndex ?? 0, 0), maxIndex),
		revealedQuestionIds: new Set<QuestionId>(),
		judgments: {},
		answerCreatedAt: {},
		questionElapsedMs: {},
		status: "active",
	};
}

function copyRecord<T>(
	record: Readonly<Partial<Record<QuestionId, T>>>,
): Partial<Record<QuestionId, T>> {
	return { ...record };
}

function copySet(values: ReadonlySet<QuestionId>): Set<QuestionId> {
	return new Set(values);
}

type ActionOf<Type extends ChallengeAction["type"]> = Extract<ChallengeAction, { type: Type }>;

function revealQuestion(
	state: ChallengeState,
	action: ActionOf<"REVEAL_QUESTION">,
): ChallengeState {
	if (
		!state.questionIds.includes(action.questionId) ||
		state.revealedQuestionIds.has(action.questionId)
	) {
		return state;
	}
	const revealedQuestionIds = copySet(state.revealedQuestionIds);
	revealedQuestionIds.add(action.questionId);
	return { ...state, revealedQuestionIds };
}

function judgeQuestion(state: ChallengeState, action: ActionOf<"JUDGE_QUESTION">): ChallengeState {
	if (!state.questionIds.includes(action.questionId)) {
		return state;
	}
	if (state.revealedQuestionIds.has(action.questionId) === false) {
		return state;
	}
	if (state.judgments[action.questionId]) {
		return state;
	}
	return {
		...state,
		judgments: { ...copyRecord(state.judgments), [action.questionId]: action.judgment },
		answerCreatedAt: {
			...copyRecord(state.answerCreatedAt),
			[action.questionId]: action.answerCreatedAt,
		},
	};
}

function applyElapsed(state: ChallengeState, action: ActionOf<"APPLY_ELAPSED">): ChallengeState {
	if (!state.questionIds.includes(action.questionId)) {
		return state;
	}
	if (!Number.isFinite(action.deltaMs) || action.deltaMs <= 0) {
		return state;
	}
	const current = state.questionElapsedMs[action.questionId] ?? 0;
	return {
		...state,
		questionElapsedMs: {
			...copyRecord(state.questionElapsedMs),
			[action.questionId]: current + action.deltaMs,
		},
	};
}

function moveTo(state: ChallengeState, action: ActionOf<"MOVE_TO">): ChallengeState {
	if (!Number.isInteger(action.index)) {
		return state;
	}
	if (action.index < 0 || action.index >= state.questionIds.length) {
		return state;
	}
	if (action.index === state.currentIndex) {
		return state;
	}
	return { ...state, currentIndex: action.index };
}

function completeChallenge(state: ChallengeState, action: ActionOf<"COMPLETE">): ChallengeState {
	return state.status === "active" && isChallengeComplete(state)
		? { ...state, status: "completed", updatedAt: action.updatedAt }
		: state;
}

export function challengeReducer(state: ChallengeState, action: ChallengeAction): ChallengeState {
	if (state.status !== "active") {
		return state;
	}
	switch (action.type) {
		case "REVEAL_QUESTION":
			return revealQuestion(state, action);
		case "JUDGE_QUESTION":
			return judgeQuestion(state, action);
		case "APPLY_ELAPSED":
			return applyElapsed(state, action);
		case "MOVE_TO":
			return moveTo(state, action);
		case "COMPLETE":
			return completeChallenge(state, action);
		case "MARK_INCOMPLETE":
			return state.status === "active" ? { ...state, status: "incomplete" } : state;
		default:
			action satisfies never;
			return state;
	}
}

export function applyElapsedDelta(
	state: ChallengeState,
	questionId: QuestionId,
	deltaMs: number,
): ChallengeState {
	return challengeReducer(state, { type: "APPLY_ELAPSED", questionId, deltaMs });
}

export function isChallengeComplete(state: ChallengeState): boolean {
	return (
		state.questionIds.length > 0 &&
		state.questionIds.every(
			(id) => state.judgments[id] !== undefined && state.answerCreatedAt[id] !== undefined,
		)
	);
}

export function createChallengeSnapshot(state: ChallengeState): ChallengeSnapshot {
	const snapshot = {
		version: 1,
		challengeId: state.challengeId,
		scopeKey: state.scopeKey,
		examId: state.examId,
		mode: state.mode,
		questionIds: [...state.questionIds],
		createdAt: state.createdAt,
		currentIndex: state.currentIndex,
		revealedQuestionIds: [...state.revealedQuestionIds],
		judgments: { ...state.judgments },
		answerCreatedAt: { ...state.answerCreatedAt },
		questionElapsedMs: { ...state.questionElapsedMs },
	} satisfies Omit<ChallengeSnapshot, "status" | "updatedAt">;
	return state.status === "completed"
		? { ...snapshot, status: "completed", updatedAt: state.updatedAt }
		: { ...snapshot, status: state.status, updatedAt: null };
}

export function restoreChallengeState(
	snapshot: Extract<ChallengeSnapshot, { status: "completed" }>,
): Extract<ChallengeState, { status: "completed" }>;
export function restoreChallengeState(snapshot: ChallengeSnapshot): ChallengeState;
export function restoreChallengeState(snapshot: ChallengeSnapshot): ChallengeState {
	return {
		...snapshot,
		questionIds: [...snapshot.questionIds],
		revealedQuestionIds: new Set(snapshot.revealedQuestionIds),
		judgments: { ...snapshot.judgments },
		answerCreatedAt: { ...snapshot.answerCreatedAt },
		questionElapsedMs: { ...snapshot.questionElapsedMs },
	};
}

export function toCompletedChallengePayload(
	state: Extract<ChallengeState, { status: "completed" }>,
	updatedAt: number,
): CompletedChallengePayload | null {
	if (!isChallengeComplete(state)) {
		return null;
	}
	const answers = state.questionIds.flatMap((questionId) => {
		const judgment = state.judgments[questionId];
		const createdAt = state.answerCreatedAt[questionId];
		if (judgment === undefined || createdAt === undefined) {
			return [];
		}
		return [
			{
				questionId,
				elapsedMs: Math.max(0, Math.round(state.questionElapsedMs[questionId] ?? 0)),
				judgment,
				createdAt,
				updatedAt,
			},
		];
	});
	if (answers.length !== state.questionIds.length) {
		return null;
	}
	return {
		challengeId: state.challengeId,
		examId: state.examId,
		createdAt: state.createdAt,
		updatedAt,
		answers,
	};
}

export function formatDuration(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60);
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return hours > 0
		? `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
		: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatAccuracy(accuracy: number | null): string {
	return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

function countJudgments(answers: readonly { judgment: Judgment }[]): Readonly<{
	correctCount: number;
	incorrectCount: number;
}> {
	const correctCount = answers.filter((answer) => answer.judgment === "correct").length;
	return { correctCount, incorrectCount: answers.length - correctCount };
}

export function summarizeChallenge(challenge: CompletedChallengePayload): ChallengeResultSummary {
	const { correctCount, incorrectCount } = countJudgments(challenge.answers);
	const judgedCount = correctCount + incorrectCount;
	return {
		challengeCount: 1,
		judgedCount,
		correctCount,
		incorrectCount,
		accuracy: judgedCount === 0 ? null : correctCount / judgedCount,
		totalElapsedMs: challenge.answers.reduce((total, answer) => total + answer.elapsedMs, 0),
	};
}

export function aggregateChallengeResults(
	completed: readonly CompletedChallengePayload[],
): ChallengeResultSummary &
	Readonly<{ byQuestion: Readonly<Record<string, QuestionResultSummary>> }> {
	const answers = completed.flatMap((challenge) => challenge.answers);
	const { correctCount, incorrectCount } = countJudgments(answers);
	const judgedCount = correctCount + incorrectCount;
	const byQuestion = answers.reduce<Record<string, QuestionResultSummary>>((result, answer) => {
		const current = result[answer.questionId] ?? {
			questionId: answer.questionId,
			challengeCount: 0,
			correctCount: 0,
			incorrectCount: 0,
			judgedCount: 0,
			totalElapsedMs: 0,
			averageElapsedMs: null,
		};
		const next = {
			...current,
			challengeCount: current.challengeCount + 1,
			correctCount: current.correctCount + (answer.judgment === "correct" ? 1 : 0),
			incorrectCount: current.incorrectCount + (answer.judgment === "incorrect" ? 1 : 0),
			judgedCount: current.judgedCount + 1,
			totalElapsedMs: current.totalElapsedMs + answer.elapsedMs,
		};
		result[answer.questionId] = {
			...next,
			averageElapsedMs: next.totalElapsedMs / next.judgedCount,
		};
		return result;
	}, {});
	return {
		challengeCount: completed.length,
		judgedCount,
		correctCount,
		incorrectCount,
		accuracy: judgedCount === 0 ? null : correctCount / judgedCount,
		totalElapsedMs: answers.reduce((total, answer) => total + answer.elapsedMs, 0),
		byQuestion,
	};
}

function canonicalChallenge(challenge: CompletedChallengePayload): CompletedChallengePayload {
	return {
		...challenge,
		answers: [...challenge.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
	};
}

export function mergeCompletedChallenges(
	local: readonly CompletedChallengePayload[],
	remote: readonly CompletedChallengePayload[],
): CompletedChallengePayload[] {
	const merged = new Map<string, CompletedChallengePayload>();
	for (const challenge of [...local, ...remote]) {
		const normalized = canonicalChallenge(challenge);
		const current = merged.get(challenge.challengeId);
		if (!current || JSON.stringify(current) === JSON.stringify(normalized)) {
			merged.set(challenge.challengeId, normalized);
		}
	}
	return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isCompletedChallengePayload(value: unknown): value is CompletedChallengePayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const challenge = value as Partial<CompletedChallengePayload>;
	return (
		typeof challenge.challengeId === "string" &&
		typeof challenge.examId === "string" &&
		typeof challenge.createdAt === "number" &&
		typeof challenge.updatedAt === "number" &&
		challenge.createdAt <= challenge.updatedAt &&
		Array.isArray(challenge.answers) &&
		challenge.answers.every((answer) => {
			if (!answer || typeof answer !== "object") {
				return false;
			}
			const candidate = answer as Partial<CompletedChallengePayload["answers"][number]>;
			return (
				typeof candidate.questionId === "string" &&
				typeof candidate.elapsedMs === "number" &&
				candidate.elapsedMs >= 0 &&
				(candidate.judgment === "correct" || candidate.judgment === "incorrect") &&
				typeof candidate.createdAt === "number" &&
				typeof candidate.updatedAt === "number" &&
				candidate.createdAt <= candidate.updatedAt &&
				candidate.updatedAt === challenge.updatedAt
			);
		})
	);
}
