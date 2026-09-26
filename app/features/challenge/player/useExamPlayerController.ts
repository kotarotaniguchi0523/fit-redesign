import { useEffect, useMemo, useReducer, useRef, useState, useViewTransition } from "hono/jsx/dom";
import { systemClock } from "../../../lib/dateTime";
import type { Judgment, QuestionId } from "../../../types";
import { EpochMillisecondsSchema, QuestionIdSchema } from "../../../types/browser";
import { measureUserInteraction } from "../../performance/userTiming";
import { recordProgressEntry } from "../../progress/progressPersistence";
import { readSyncKey } from "../../progress/progressStorage";
import type { ChallengeAction } from "../challenge";
import {
	applyElapsedDelta,
	calculateElapsedDelta,
	challengeReducer,
	createChallengeSnapshot,
	isChallengeComplete,
	restoreChallengeState,
	toCompletedChallengePayload,
} from "../challenge";
import { challengeSyncErrorMessage, syncChallenges } from "../challengeApi";
import {
	archiveCompletedChallenge,
	createChallengeStateFromSnapshot,
	discardActiveChallenge,
	findChallenge,
	findActiveChallenge as findStoredActiveChallenge,
	hasActiveChallengeLock,
	markActiveChallengeIncomplete,
	mergeCompletedChallengeHistory,
	readCompletedChallenges,
	releaseChallengeLock,
	renewChallengeLock,
	saveActiveChallenge,
	tryAcquireChallengeLock,
} from "../challengeStorage";
import type { ChallengeSnapshot, ChallengeState, CompletedChallengePayload } from "../types";
import { generateChallengeId } from "./id";
import {
	countJudgments,
	createPlayerChallenge,
	filterChallengeHistory,
	getNavigationPosition,
	isModeEntryTarget,
	questionScopeKey,
} from "./model";
import { replaceChallengeView, replaceQuestionInUrl } from "./navigation";
import { type MutableTimerRuntime, resetTimerRuntimeInPlace } from "./timerRuntime";
import type { ExamPlayerProps, PlayerQuestion } from "./types";

export type PlayerPhase = "player" | "resume" | "result" | "missing" | "locked";

export type ExamPlayerController = Readonly<{
	state: ChallengeState | null;
	phase: PlayerPhase;
	solutionOpen: boolean;
	questionListOpen: boolean;
	timerRunning: boolean;
	resultPayload: CompletedChallengePayload | null;
	resultHistory: readonly CompletedChallengePayload[];
	syncMessage: string | null;
	navigationDirection: "forward" | "backward" | "none";
	currentQuestionId: QuestionId | undefined;
	currentQuestion: PlayerQuestion | undefined;
	currentJudgment: Judgment | undefined;
	currentQuestionElapsedMs: number;
	currentQuestionIndex: number;
	navigationLength: number;
	isFirst: boolean;
	isLast: boolean;
	totalElapsedMs: number;
	modeEntryTarget: boolean;
	canFinish: boolean;
	startNewChallenge: (requestedIndex?: number, animate?: boolean, shouldRun?: boolean) => void;
	finishChallenge: () => void;
	openQuestionList: () => void;
	closeQuestionList: () => void;
	toggleTimer: () => void;
	toggleAnswer: () => void;
	judgeCurrentQuestion: (judgment: Judgment) => void;
	selectHeaderQuestion: (index: number) => void;
	selectListedQuestion: (index: number) => void;
	movePrevious: () => void;
	moveNext: () => void;
	resumeCurrentChallenge: () => void;
	restartCurrentChallenge: () => void;
}>;

type PlayerAction = ChallengeAction | Readonly<{ type: "INIT"; state: ChallengeState }>;

function playerReducer(state: ChallengeState | null, action: PlayerAction): ChallengeState | null {
	if (action.type === "INIT") {
		return action.state;
	}
	return state ? challengeReducer(state, action) : state;
}

type InitialResultView =
	| Readonly<{ kind: "not-result" }>
	| Readonly<{ kind: "missing" }>
	| Readonly<{ kind: "ready"; payload: CompletedChallengePayload }>;

function resolveInitialResultView(props: ExamPlayerProps): InitialResultView {
	if (props.initialView !== "result") {
		return { kind: "not-result" };
	}
	if (!props.initialChallengeId) {
		return { kind: "missing" };
	}
	const snapshot = findChallenge(props.initialChallengeId);
	if (snapshot?.status !== "completed") {
		return { kind: "missing" };
	}
	const restored = restoreChallengeState(snapshot);
	const payload = toCompletedChallengePayload(restored, snapshot.updatedAt);
	return payload ? { kind: "ready", payload } : { kind: "missing" };
}

export function useExamPlayerController(props: ExamPlayerProps): ExamPlayerController {
	const { questions } = props;
	const [state, dispatch] = useReducer(playerReducer, null);
	const [phase, setPhase] = useState<PlayerPhase>(
		props.initialView === "result" ? "result" : "player",
	);
	const [solutionOpen, setSolutionOpen] = useState(false);
	const [questionListOpen, setQuestionListOpen] = useState(false);
	const [timerRunning, setTimerRunning] = useState(false);
	const [resultPayload, setResultPayload] = useState<CompletedChallengePayload | null>(null);
	const [resultHistory, setResultHistory] = useState<readonly CompletedChallengePayload[]>([]);
	const [syncMessage, setSyncMessage] = useState<string | null>(null);
	const [navigationDirection, setNavigationDirection] = useState<"forward" | "backward" | "none">(
		"none",
	);
	const stateRef = useRef<ChallengeState | null>(null);
	const phaseRef = useRef<PlayerPhase>(phase);
	const userPausedRef = useRef(false);
	const runtimeRef = useRef<MutableTimerRuntime>({
		running: false,
		lastSample: null,
		currentQuestionId: QuestionIdSchema.parse(questions[0]?.id),
	});
	const ownerIdRef = useRef("");
	const hasInitialized = useRef(false);
	const lastPersistAt = useRef(0);
	const [, startViewTransition] = useViewTransition();
	stateRef.current = state;
	phaseRef.current = phase;

	const getOwnerId = (): string => {
		if (!ownerIdRef.current) {
			ownerIdRef.current = generateChallengeId();
		}
		return ownerIdRef.current;
	};
	const questionById = useMemo(
		() => new Map(questions.map((question) => [question.id, question])),
		[questions],
	);
	const questionIndexById = useMemo(
		() => new Map(questions.map((question, index) => [question.id, index])),
		[questions],
	);
	const getQuestionIndex = (questionId?: QuestionId): number => {
		if (!questionId) {
			return 0;
		}
		return questionIndexById.get(questionId) ?? 0;
	};
	const scopeKey = questionScopeKey(props.examId, props.mode, props.requestedQuestionId);

	const persistState = (nextState: ChallengeState, force = false): void => {
		const now = typeof performance === "undefined" ? 0 : performance.now();
		if (force || now - lastPersistAt.current >= 5000) {
			saveActiveChallenge(nextState);
			lastPersistAt.current = now;
		}
	};

	const flushTimer = (forcePersist = false): ChallengeState | null => {
		const current = stateRef.current;
		if (!current || phaseRef.current !== "player") {
			return current;
		}
		const runtime = runtimeRef.current;
		const now = performance.now();
		const deltaMs = calculateElapsedDelta(runtime, now);
		runtime.lastSample = now;
		if (!runtime.running || deltaMs <= 0) {
			return current;
		}
		const next = applyElapsedDelta(current, runtime.currentQuestionId, deltaMs);
		dispatch({ type: "APPLY_ELAPSED", questionId: runtime.currentQuestionId, deltaMs });
		persistState(next, forcePersist);
		return next;
	};

	const startNewChallenge = (requestedIndex?: number, animate = false, shouldRun = true): void => {
		if (questions.length === 0) {
			return;
		}
		const activeQuestionId = stateRef.current?.questionIds[stateRef.current.currentIndex];
		const challenge = createPlayerChallenge(
			props,
			questions,
			scopeKey,
			requestedIndex,
			activeQuestionId,
			getQuestionIndex,
			generateChallengeId(),
			systemClock.nowEpochMilliseconds(),
		);
		if (!challenge) {
			return;
		}
		const { state: next, question: initialQuestion } = challenge;
		const acquiredLock = tryAcquireChallengeLock(next.challengeId, getOwnerId());
		if (acquiredLock) {
			resetTimerRuntimeInPlace(runtimeRef.current, next.questionIds[next.currentIndex]);
			saveActiveChallenge(next);
			lastPersistAt.current = typeof performance === "undefined" ? 0 : performance.now();
		}
		const initializeState = (): void => dispatch({ type: "INIT", state: next });
		if (animate) {
			startViewTransition(initializeState);
		} else {
			initializeState();
		}
		if (!acquiredLock) {
			setTimerRunning(false);
			setPhase("locked");
			return;
		}
		setResultPayload(null);
		setQuestionListOpen(false);
		userPausedRef.current = !shouldRun;
		setTimerRunning(shouldRun && document.visibilityState === "visible");
		setPhase("player");
		if (props.mode === "question") {
			replaceQuestionInUrl(initialQuestion.id);
		}
		replaceChallengeView("player");
	};

	const resumeChallenge = (
		snapshot: ChallengeSnapshot,
		animate = false,
		shouldRun = true,
	): void => {
		const next = createChallengeStateFromSnapshot(snapshot);
		resetTimerRuntimeInPlace(runtimeRef.current, next.questionIds[next.currentIndex]);
		if (animate) {
			startViewTransition(() => dispatch({ type: "INIT", state: next }));
		} else {
			dispatch({ type: "INIT", state: next });
		}
		setResultPayload(null);
		const canResume = tryAcquireChallengeLock(next.challengeId, getOwnerId());
		userPausedRef.current = !shouldRun;
		setTimerRunning(canResume && shouldRun && document.visibilityState === "visible");
		setQuestionListOpen(false);
		setPhase(canResume ? "player" : "locked");
		if (props.mode === "question") {
			const questionId = next.questionIds[next.currentIndex];
			if (questionId) {
				replaceQuestionInUrl(questionId);
			}
		}
	};

	const challengeHistoryForScope = (
		payload: CompletedChallengePayload,
	): CompletedChallengePayload[] => {
		const questionId =
			props.mode === "question"
				? (payload.answers[0]?.questionId ?? props.requestedQuestionId)
				: props.requestedQuestionId;
		return filterChallengeHistory(
			readCompletedChallenges(),
			payload.examId,
			props.mode,
			questionId,
		);
	};

	const finishChallenge = (): void => {
		const current = flushTimer();
		if (!(current && isChallengeComplete(current))) {
			return;
		}
		const updatedAt = systemClock.nowEpochMilliseconds();
		const archived = archiveCompletedChallenge(current, updatedAt);
		if (!archived) {
			return;
		}
		const { payload, persisted } = archived;
		if (!persisted) {
			setSyncMessage("この端末に結果を保存できませんでした。画面を閉じる前に同期してください。");
		}
		runtimeRef.current.running = false;
		setTimerRunning(false);
		dispatch({ type: "COMPLETE", updatedAt });
		setResultPayload(payload);
		replaceChallengeView("result", payload.challengeId);
		setResultHistory(challengeHistoryForScope(payload));
		setPhase("result");
		const syncKey = readSyncKey();
		if (syncKey) {
			syncChallenges(syncKey, [payload]).match(
				(merged) => {
					mergeCompletedChallengeHistory(merged);
					setResultHistory(
						filterChallengeHistory(
							merged,
							props.examId,
							props.mode,
							props.mode === "question"
								? (payload.answers[0]?.questionId ?? props.requestedQuestionId)
								: props.requestedQuestionId,
						),
					);
				},
				(error) => setSyncMessage(challengeSyncErrorMessage(error)),
			);
		}
	};

	const initializeResultView = (): boolean => {
		const resultView = resolveInitialResultView(props);
		if (resultView.kind === "not-result") {
			return false;
		}
		if (resultView.kind === "missing") {
			setPhase("missing");
			return true;
		}
		setResultPayload(resultView.payload);
		setResultHistory(challengeHistoryForScope(resultView.payload));
		return true;
	};

	const initializeChallenge = (): void => {
		if (initializeResultView()) {
			return;
		}
		const active = findStoredActiveChallenge(scopeKey);
		if (active) {
			dispatch({ type: "INIT", state: restoreChallengeState(active) });
			setPhase("resume");
			return;
		}
		startNewChallenge();
	};

	useEffect(() => {
		if (hasInitialized.current) {
			return;
		}
		hasInitialized.current = true;
		initializeChallenge();
	}, []);

	useEffect(() => {
		if (phase !== "player" || !state) {
			return;
		}
		const currentQuestionId = state.questionIds[state.currentIndex];
		if (!currentQuestionId) {
			return;
		}
		if (
			runtimeRef.current.currentQuestionId !== currentQuestionId ||
			runtimeRef.current.lastSample === null
		) {
			runtimeRef.current.currentQuestionId = currentQuestionId;
			runtimeRef.current.running =
				document.visibilityState === "visible" && !questionListOpen && !userPausedRef.current;
			runtimeRef.current.lastSample = performance.now();
			setTimerRunning(runtimeRef.current.running);
		}
		setSolutionOpen(false);
	}, [phase, questionListOpen, state?.currentIndex]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			if (phaseRef.current !== "player" || document.visibilityState !== "visible") {
				return;
			}
			flushTimer();
		}, 1000);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "hidden") {
				const flushed = flushTimer(true);
				runtimeRef.current.running = false;
				setTimerRunning(false);
				if (flushed) {
					saveActiveChallenge(flushed);
				}
			} else if (phaseRef.current === "player") {
				runtimeRef.current.lastSample = performance.now();
				runtimeRef.current.running = !(questionListOpen || userPausedRef.current);
				setTimerRunning(runtimeRef.current.running);
			}
		};
		const onPageHide = (): void => {
			const flushed = flushTimer(true);
			if (flushed) {
				saveActiveChallenge(flushed);
			}
			runtimeRef.current.running = false;
			setTimerRunning(false);
		};
		const onPageShow = (): void => {
			if (phaseRef.current === "player" && document.visibilityState === "visible") {
				runtimeRef.current.lastSample = performance.now();
				runtimeRef.current.running = !(questionListOpen || userPausedRef.current);
				setTimerRunning(runtimeRef.current.running);
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("pagehide", onPageHide);
		window.addEventListener("pageshow", onPageShow);
		return (): void => {
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("pagehide", onPageHide);
			window.removeEventListener("pageshow", onPageShow);
		};
	}, [questionListOpen]);

	useEffect(() => {
		if (phase !== "player" || !state) {
			return;
		}
		const challengeId = state.challengeId;
		const ownerId = getOwnerId();
		if (!tryAcquireChallengeLock(challengeId, ownerId)) {
			setPhase("locked");
			return;
		}
		const heartbeat = window.setInterval(() => {
			if (!renewChallengeLock(challengeId, ownerId)) {
				setPhase("locked");
			}
		}, 5000);
		const onStorage = (event: StorageEvent): void => {
			if (event.key === "fit-challenge-locks-v1" && hasActiveChallengeLock(challengeId, ownerId)) {
				setPhase("locked");
			}
		};
		const onPageHide = (): void => {
			releaseChallengeLock(challengeId, ownerId);
		};
		const onPageShow = (): void => {
			if (tryAcquireChallengeLock(challengeId, ownerId)) {
				if (phaseRef.current === "locked") {
					setPhase("player");
				}
			} else {
				setPhase("locked");
			}
		};
		window.addEventListener("storage", onStorage);
		window.addEventListener("pagehide", onPageHide);
		window.addEventListener("pageshow", onPageShow);
		return (): void => {
			window.clearInterval(heartbeat);
			window.removeEventListener("storage", onStorage);
			window.removeEventListener("pagehide", onPageHide);
			window.removeEventListener("pageshow", onPageShow);
			releaseChallengeLock(challengeId, ownerId);
		};
	}, [phase, state?.challengeId]);

	const currentQuestionId = state?.questionIds[state.currentIndex];
	const currentQuestion = currentQuestionId ? questionById.get(currentQuestionId) : undefined;
	const { currentQuestionIndex, navigationLength } =
		state && currentQuestionId
			? getNavigationPosition(props.mode, currentQuestionId, state, questions, getQuestionIndex)
			: { currentQuestionIndex: 0, navigationLength: questions.length };
	const currentQuestionIndexInState = state?.currentIndex ?? 0;
	const isFirst = currentQuestionIndex === 0;
	const isLast = currentQuestionIndex === navigationLength - 1;
	const totalElapsedMs = Object.values(state?.questionElapsedMs ?? {}).reduce<number>(
		(sum, value) => sum + (value ?? 0),
		0,
	);

	const moveTo = (index: number): void => {
		const current = flushTimer(true);
		if (!current || index < 0 || index >= current.questionIds.length) {
			return;
		}
		setNavigationDirection(index >= currentQuestionIndexInState ? "forward" : "backward");
		runtimeRef.current.running = false;
		setTimerRunning(false);
		startViewTransition(() =>
			measureUserInteraction("fit-redesign:quiz-question-update", () =>
				dispatch({ type: "MOVE_TO", index }),
			),
		);
		persistState({ ...current, currentIndex: index }, true);
	};
	const openQuestionList = (): void => {
		const current = flushTimer(true);
		if (current) {
			saveActiveChallenge(current);
		}
		runtimeRef.current.running = false;
		setTimerRunning(false);
		setQuestionListOpen(true);
	};
	const closeQuestionList = (): void => {
		const selectedQuestionId = state?.questionIds[currentQuestionIndexInState];
		if (selectedQuestionId) {
			runtimeRef.current.currentQuestionId = selectedQuestionId;
			runtimeRef.current.lastSample = performance.now();
			runtimeRef.current.running = document.visibilityState === "visible" && !userPausedRef.current;
			setTimerRunning(runtimeRef.current.running);
		}
		setQuestionListOpen(false);
	};
	const moveFocusTo = (index: number): void => {
		const targetQuestion = questions[index];
		if (!(targetQuestion && currentQuestionId)) {
			return;
		}
		if (targetQuestion.id === currentQuestionId) {
			closeQuestionList();
			return;
		}
		const current = flushTimer(true);
		if (!current) {
			return;
		}
		saveActiveChallenge(current);
		releaseChallengeLock(current.challengeId, getOwnerId());
		runtimeRef.current.running = false;
		setTimerRunning(false);
		setNavigationDirection(index > currentQuestionIndex ? "forward" : "backward");
		setQuestionListOpen(false);
		setSolutionOpen(false);
		const targetScopeKey = questionScopeKey(props.examId, "question", targetQuestion.id);
		const active = findStoredActiveChallenge(targetScopeKey);
		if (active) {
			resumeChallenge(active, true, !userPausedRef.current);
			return;
		}
		startNewChallenge(index, true, !userPausedRef.current);
	};
	const toggleTimer = (): void => {
		const nextRunning = !timerRunning;
		if (!nextRunning) {
			flushTimer(true);
		}
		runtimeRef.current.lastSample = performance.now();
		runtimeRef.current.running = nextRunning;
		userPausedRef.current = !nextRunning;
		setTimerRunning(nextRunning);
	};
	const toggleAnswer = (): void => {
		if (solutionOpen) {
			setSolutionOpen(false);
			return;
		}
		setSolutionOpen(true);
		const current = stateRef.current;
		if (!(current && currentQuestionId)) {
			return;
		}
		const revealAction = { type: "REVEAL_QUESTION" as const, questionId: currentQuestionId };
		dispatch(revealAction);
		saveActiveChallenge(challengeReducer(current, revealAction));
		const timestamp = EpochMillisecondsSchema.safeParse(systemClock.nowEpochMilliseconds());
		if (!timestamp.success) {
			return;
		}
		recordProgressEntry({
			questionId: currentQuestionId,
			unitId: props.unitId,
			createdAt: timestamp.data,
			updatedAt: timestamp.data,
		});
	};
	const judgeCurrentQuestion = (judgment: Judgment): void => {
		if (!(state && currentQuestionId) || state.judgments[currentQuestionId]) {
			return;
		}
		const current = flushTimer(true);
		if (!current) {
			return;
		}
		const judgmentAction = {
			type: "JUDGE_QUESTION" as const,
			questionId: currentQuestionId,
			judgment,
			answerCreatedAt: systemClock.nowEpochMilliseconds(),
		};
		dispatch(judgmentAction);
		saveActiveChallenge(challengeReducer(current, judgmentAction));
	};
	const selectHeaderQuestion = (index: number): void => {
		if (props.mode === "question") {
			moveFocusTo(index);
		} else if (state && index !== state.currentIndex) {
			moveTo(index);
		}
	};
	const selectListedQuestion = (index: number): void => {
		if (props.mode === "question") {
			moveFocusTo(index);
		} else if (state && index === state.currentIndex) {
			closeQuestionList();
		} else {
			setQuestionListOpen(false);
			moveTo(index);
		}
	};
	const movePrevious = (): void => {
		if (props.mode === "question") {
			moveFocusTo(currentQuestionIndex - 1);
		} else {
			moveTo(currentQuestionIndexInState - 1);
		}
	};
	const moveNext = (): void => {
		if (props.mode === "question") {
			moveFocusTo(currentQuestionIndex + 1);
		} else {
			moveTo(currentQuestionIndexInState + 1);
		}
	};
	const resumeCurrentChallenge = (): void => {
		if (state) {
			resumeChallenge(createChallengeSnapshot(state));
		}
	};
	const restartCurrentChallenge = (): void => {
		if (state) {
			if (countJudgments(state) > 0) {
				markActiveChallengeIncomplete(state);
			} else {
				discardActiveChallenge(state.challengeId);
			}
		}
		startNewChallenge();
	};

	return {
		state,
		phase,
		solutionOpen,
		questionListOpen,
		timerRunning,
		resultPayload,
		resultHistory,
		syncMessage,
		navigationDirection,
		currentQuestionId,
		currentQuestion,
		currentJudgment: currentQuestionId ? state?.judgments[currentQuestionId] : undefined,
		currentQuestionElapsedMs: currentQuestionId
			? (state?.questionElapsedMs[currentQuestionId] ?? 0)
			: 0,
		currentQuestionIndex,
		navigationLength,
		isFirst,
		isLast,
		totalElapsedMs,
		modeEntryTarget:
			currentQuestionId && state
				? isModeEntryTarget(
						props.mode,
						currentQuestionId,
						props.requestedQuestionId,
						state.currentIndex,
					)
				: false,
		canFinish: state ? isChallengeComplete(state) : false,
		startNewChallenge,
		finishChallenge,
		openQuestionList,
		closeQuestionList,
		toggleTimer,
		toggleAnswer,
		judgeCurrentQuestion,
		selectHeaderQuestion,
		selectListedQuestion,
		movePrevious,
		moveNext,
		resumeCurrentChallenge,
		restartCurrentChallenge,
	};
}
