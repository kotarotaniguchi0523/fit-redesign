import { systemClock } from "../../../lib/dateTime";
import { restoreChallengeState, toCompletedChallengePayload } from "../challenge";
import {
	createChallengeStateFromSnapshot,
	findActiveChallenge,
	findChallenge,
	readCompletedChallenges,
} from "../challengeStorage";
import type { ChallengeState, CompletedChallengePayload } from "../types";
import { generateChallengeId } from "./id";
import { readInitialChallengeView } from "./initialView";
import { createPlayerChallenge, filterChallengeHistory, questionScopeKey } from "./model";
import type { ExamPlayerProps } from "./types";

export type InitialPlayerSession = Readonly<{
	kind: "server" | "new" | "resume" | "result" | "missing";
	state: ChallengeState | null;
	phase: "player" | "resume" | "result" | "missing";
	resultPayload: CompletedChallengePayload | null;
	resultHistory: readonly CompletedChallengePayload[];
}>;

const emptySession: InitialPlayerSession = {
	kind: "server",
	state: null,
	phase: "player",
	resultPayload: null,
	resultHistory: [],
};

function getHistoryForScope(
	props: ExamPlayerProps,
	payload: CompletedChallengePayload,
): CompletedChallengePayload[] {
	const questionId =
		props.mode === "question"
			? (payload.answers[0]?.questionId ?? props.requestedQuestionId)
			: props.requestedQuestionId;
	return filterChallengeHistory(readCompletedChallenges(), payload.examId, props.mode, questionId);
}

function resolveInitialResult(props: ExamPlayerProps): InitialPlayerSession | null {
	const { view, challengeId } = readInitialChallengeView(window.location.search);
	if (view !== "result") {
		return null;
	}
	if (!challengeId) {
		return { ...emptySession, kind: "missing", phase: "missing" };
	}
	const snapshot = findChallenge(challengeId);
	if (snapshot?.status !== "completed") {
		return { ...emptySession, kind: "missing", phase: "missing" };
	}
	const payload = toCompletedChallengePayload(restoreChallengeState(snapshot), snapshot.updatedAt);
	if (!payload) {
		return { ...emptySession, kind: "missing", phase: "missing" };
	}
	return {
		kind: "result",
		state: null,
		phase: "result",
		resultPayload: payload,
		resultHistory: getHistoryForScope(props, payload),
	};
}

/**
 * Resolve browser-local session data before the player's first client render.
 * Server rendering deliberately keeps the static question preview and performs no storage reads.
 */
export function resolveInitialPlayerSession(props: ExamPlayerProps): InitialPlayerSession {
	if (typeof window === "undefined") {
		return emptySession;
	}

	const result = resolveInitialResult(props);
	if (result) {
		return result;
	}

	const scopeKey = questionScopeKey(props.examId, props.mode, props.requestedQuestionId);
	const active = findActiveChallenge(scopeKey);
	if (active) {
		return {
			kind: "resume",
			state: createChallengeStateFromSnapshot(active),
			phase: "resume",
			resultPayload: null,
			resultHistory: [],
		};
	}

	const challenge = createPlayerChallenge(
		props,
		props.questions,
		scopeKey,
		undefined,
		props.requestedQuestionId,
		(questionId) => props.questions.findIndex((question) => question.id === questionId),
		generateChallengeId(),
		systemClock.nowEpochMilliseconds(),
	);
	if (!challenge) {
		return { ...emptySession, kind: "missing", phase: "missing" };
	}
	return {
		kind: "new",
		state: challenge.state,
		phase: "player",
		resultPayload: null,
		resultHistory: [],
	};
}
