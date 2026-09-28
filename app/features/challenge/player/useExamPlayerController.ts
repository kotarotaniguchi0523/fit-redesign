import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useViewTransition,
} from "hono/jsx/dom";
import { systemClock } from "../../../lib/dateTime";
import type { Judgment, QuestionId } from "../../../types";
import { EpochMillisecondsSchema, QuestionIdSchema } from "../../../types/browser";
import { measureUserInteraction } from "../../performance/userTiming";
import { recordProgressEntry } from "../../progress/progressPersistence";
import { readSyncKey } from "../../progress/progressStorage";
import type { ChallengeAction } from "../challenge";
import { challengeReducer, createChallengeSnapshot, isChallengeComplete } from "../challenge";
import { challengeSyncErrorMessage, syncChallenges } from "../challengeApi";
import {
	archiveCompletedChallenge,
	createChallengeStateFromSnapshot,
	discardActiveChallenge,
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
import { resolveInitialPlayerSession } from "./initialPlayerSession";
import {
	countJudgments,
	createPlayerChallenge,
	filterChallengeHistory,
	getNavigationPosition,
	isModeEntryTarget,
	questionScopeKey,
} from "./model";
import { replaceChallengeView, replaceQuestionInUrl } from "./navigation";
import {
	type MutableTimerRuntime,
	resetTimerRuntimeInPlace,
	sampleChallengeTimer,
} from "./timerRuntime";
import type { ExamPlayerProps, PlayerQuestion } from "./types";

export type PlayerPhase = "player" | "resume" | "result" | "missing" | "locked";

function useStableCallback<Args extends unknown[], Result>(
	callback: (...args: Args) => Result,
): (...args: Args) => Result {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;
	return useCallback((...args: Args): Result => callbackRef.current(...args), []);
}

function shouldStartVisibleTimer(shouldRun: boolean): boolean {
	return shouldRun && document.visibilityState === "visible";
}

function commitWithTransition(
	commit: () => void,
	animate: boolean,
	startViewTransition: ReturnType<typeof useViewTransition>[1],
): void {
	if (animate) {
		startViewTransition(commit);
	} else {
		commit();
	}
}

function replaceQuestionUrlForMode(mode: ExamPlayerProps["mode"], questionId: QuestionId): void {
	if (mode === "question") {
		replaceQuestionInUrl(questionId);
	}
}

export type ExamPlayerController = Readonly<{
	state: ChallengeState | null;
	phase: PlayerPhase;
	solutionOpen: boolean;
	questionListOpen: boolean;
	timerRunning: boolean;
	timerStartedAt: number | null;
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

export function useExamPlayerController(props: ExamPlayerProps): ExamPlayerController {
	const { questions } = props;
	const scopeKey = questionScopeKey(props.examId, props.mode, props.requestedQuestionId);
	const [initialSession] = useState(() => {
		if (typeof window !== "undefined" && typeof performance !== "undefined") {
			performance.mark("fit-redesign:quiz-player-initialize-start");
		}
		return resolveInitialPlayerSession(props);
	});
	const [state, setState] = useState(initialSession.state);
	const [phase, setPhase] = useState<PlayerPhase>(initialSession.phase);
	const [solutionOpen, setSolutionOpen] = useState(false);
	const [questionListOpen, setQuestionListOpen] = useState(false);
	const [initialTimerRuntime] = useState(() => {
		const running =
			initialSession.kind === "new" &&
			typeof document !== "undefined" &&
			document.visibilityState === "visible";
		return {
			running,
			lastSample: running && typeof performance !== "undefined" ? performance.now() : null,
			currentQuestionId: QuestionIdSchema.parse(questions[0]?.id),
		};
	});
	const [timerRunning, setTimerRunning] = useState(initialTimerRuntime.running);
	const [resultPayload, setResultPayload] = useState<CompletedChallengePayload | null>(
		initialSession.resultPayload,
	);
	const [resultHistory, setResultHistory] = useState<readonly CompletedChallengePayload[]>(
		initialSession.resultHistory,
	);
	const [syncMessage, setSyncMessage] = useState<string | null>(null);
	const [navigationDirection, setNavigationDirection] = useState<"forward" | "backward" | "none">(
		"none",
	);
	const stateRef = useRef<ChallengeState | null>(state);
	const phaseRef = useRef<PlayerPhase>(phase);
	const userPausedRef = useRef(false);
	const ownedLocksRef = useRef(new Set<string>());
	const runtimeRef = useRef<MutableTimerRuntime>(initialTimerRuntime);
	const ownerIdRef = useRef("");
	const hasInitialized = useRef(false);
	const startupMeasured = useRef(false);
	const lastPersistAt = useRef(0);
	const [, startViewTransition] = useViewTransition();
	phaseRef.current = phase;
	const commitState = (nextState: ChallengeState): void => {
		stateRef.current = nextState;
		setState(nextState);
	};
	const applyChallengeAction = (action: ChallengeAction): ChallengeState | null => {
		const current = stateRef.current;
		if (!current) {
			return null;
		}
		const next = challengeReducer(current, action);
		commitState(next);
		return next;
	};

	const getOwnerId = (): string => {
		if (!ownerIdRef.current) {
			ownerIdRef.current = generateChallengeId();
		}
		return ownerIdRef.current;
	};
	const acquireLock = (challengeId: string): boolean => {
		const acquired = tryAcquireChallengeLock(challengeId, getOwnerId());
		if (acquired) {
			ownedLocksRef.current.add(challengeId);
		}
		return acquired;
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
		const sample = sampleChallengeTimer(current, runtime, now);
		if (sample.deltaMs <= 0) {
			return current;
		}
		stateRef.current = sample.state;
		persistState(sample.state, forcePersist);
		return sample.state;
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
		const acquiredLock = acquireLock(next.challengeId);
		const shouldRunTimer = shouldStartVisibleTimer(shouldRun);
		if (acquiredLock) {
			resetTimerRuntimeInPlace(runtimeRef.current, next.questionIds[next.currentIndex]);
			runtimeRef.current.running = shouldRunTimer;
			runtimeRef.current.lastSample = shouldRunTimer ? performance.now() : null;
			saveActiveChallenge(next);
			lastPersistAt.current = typeof performance === "undefined" ? 0 : performance.now();
		}
		const initializeState = (): void => commitState(next);
		commitWithTransition(initializeState, animate, startViewTransition);
		if (!acquiredLock) {
			setTimerRunning(false);
			setPhase("locked");
			return;
		}
		setResultPayload(null);
		setQuestionListOpen(false);
		userPausedRef.current = !shouldRun;
		setTimerRunning(shouldRunTimer);
		setPhase("player");
		replaceQuestionUrlForMode(props.mode, initialQuestion.id);
		replaceChallengeView("player");
	};

	const resumeChallenge = (
		snapshot: ChallengeSnapshot,
		animate = false,
		shouldRun = true,
	): void => {
		const next = createChallengeStateFromSnapshot(snapshot);
		resetTimerRuntimeInPlace(runtimeRef.current, next.questionIds[next.currentIndex]);
		const initializeState = (): void => commitState(next);
		commitWithTransition(initializeState, animate, startViewTransition);
		setResultPayload(null);
		const canResume = acquireLock(next.challengeId);
		const shouldRunTimer = canResume && shouldStartVisibleTimer(shouldRun);
		runtimeRef.current.running = shouldRunTimer;
		runtimeRef.current.lastSample = shouldRunTimer ? performance.now() : null;
		userPausedRef.current = !shouldRun;
		setTimerRunning(shouldRunTimer);
		setQuestionListOpen(false);
		setPhase(canResume ? "player" : "locked");
		const questionId = next.questionIds[next.currentIndex];
		if (questionId) {
			replaceQuestionUrlForMode(props.mode, questionId);
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
		applyChallengeAction({ type: "COMPLETE", updatedAt });
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

	useLayoutEffect(() => {
		if (hasInitialized.current) {
			return;
		}
		hasInitialized.current = true;
		if (initialSession.kind === "new" && state) {
			const questionId = state.questionIds[state.currentIndex];
			const acquiredLock = acquireLock(state.challengeId);
			if (acquiredLock) {
				if (questionId) {
					runtimeRef.current.currentQuestionId = questionId;
				}
				runtimeRef.current.running = document.visibilityState === "visible";
				runtimeRef.current.lastSample ??= performance.now();
				saveActiveChallenge(state);
				lastPersistAt.current = performance.now();
				setTimerRunning(runtimeRef.current.running);
			} else {
				runtimeRef.current.running = false;
				setTimerRunning(false);
				setPhase("locked");
			}
		}
		if (typeof performance !== "undefined") {
			performance.mark("fit-redesign:quiz-player-initialize-end");
			performance.measure("fit-redesign:quiz-player-initialize", {
				start: "fit-redesign:quiz-player-initialize-start",
				end: "fit-redesign:quiz-player-initialize-end",
			});
		}
	}, []);

	useLayoutEffect(() => {
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

	useLayoutEffect(() => {
		if (startupMeasured.current || phase !== "player" || !state) {
			return;
		}
		startupMeasured.current = true;
		if (typeof performance !== "undefined") {
			performance.mark("fit-redesign:quiz-player-ready");
			performance.measure("fit-redesign:quiz-player-mount-to-ready", {
				start: "fit-redesign:quiz-player-initialize-start",
				end: "fit-redesign:quiz-player-ready",
			});
		}
	}, [phase, state]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			if (phaseRef.current !== "player" || document.visibilityState !== "visible") {
				return;
			}
			flushTimer();
		}, 5000);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "hidden") {
				const flushed = flushTimer(true);
				runtimeRef.current.running = false;
				setTimerRunning(false);
				if (flushed) {
					commitState(flushed);
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
				commitState(flushed);
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
		if (!(ownedLocksRef.current.has(challengeId) || acquireLock(challengeId))) {
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
			ownedLocksRef.current.delete(challengeId);
		};
		const onPageShow = (): void => {
			if (acquireLock(challengeId)) {
				if (phaseRef.current === "locked") {
					setPhase("player");
				}
			} else {
				ownedLocksRef.current.delete(challengeId);
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
			if (ownedLocksRef.current.delete(challengeId)) {
				releaseChallengeLock(challengeId, ownerId);
			}
		};
	}, [phase, state?.challengeId]);

	const renderState = stateRef.current ?? state;
	const currentQuestionId = renderState?.questionIds[renderState.currentIndex];
	const currentQuestion = currentQuestionId ? questionById.get(currentQuestionId) : undefined;
	const { currentQuestionIndex, navigationLength } =
		renderState && currentQuestionId
			? getNavigationPosition(
					props.mode,
					currentQuestionId,
					renderState,
					questions,
					getQuestionIndex,
				)
			: { currentQuestionIndex: 0, navigationLength: questions.length };
	const currentQuestionIndexInState = renderState?.currentIndex ?? 0;
	const isFirst = currentQuestionIndex === 0;
	const isLast = currentQuestionIndex === navigationLength - 1;
	const totalElapsedMs = Object.values(renderState?.questionElapsedMs ?? {}).reduce<number>(
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
				applyChallengeAction({ type: "MOVE_TO", index }),
			),
		);
		persistState({ ...current, currentIndex: index }, true);
	};
	const openQuestionList = (): void => {
		const current = flushTimer(true);
		if (current) {
			commitState(current);
			saveActiveChallenge(current);
		}
		runtimeRef.current.running = false;
		setTimerRunning(false);
		setQuestionListOpen(true);
	};
	const closeQuestionList = (): void => {
		const selectedQuestionId = renderState?.questionIds[currentQuestionIndexInState];
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
		ownedLocksRef.current.delete(current.challengeId);
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
			const current = flushTimer(true);
			if (current) {
				commitState(current);
			}
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
		const revealed = applyChallengeAction(revealAction);
		if (revealed) {
			saveActiveChallenge(revealed);
		}
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
		if (!(renderState && currentQuestionId) || renderState.judgments[currentQuestionId]) {
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
		const judged = applyChallengeAction(judgmentAction);
		if (judged) {
			saveActiveChallenge(judged);
		}
	};
	const selectHeaderQuestion = (index: number): void => {
		if (props.mode === "question") {
			moveFocusTo(index);
		} else if (renderState && index !== renderState.currentIndex) {
			moveTo(index);
		}
	};
	const selectListedQuestion = (index: number): void => {
		if (props.mode === "question") {
			moveFocusTo(index);
		} else if (renderState && index === renderState.currentIndex) {
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
		if (renderState) {
			resumeChallenge(createChallengeSnapshot(renderState));
		}
	};
	const restartCurrentChallenge = (): void => {
		if (renderState) {
			if (countJudgments(renderState) > 0) {
				markActiveChallengeIncomplete(renderState);
			} else {
				discardActiveChallenge(renderState.challengeId);
			}
		}
		startNewChallenge();
	};
	const stableStartNewChallenge = useStableCallback(startNewChallenge);
	const stableFinishChallenge = useStableCallback(finishChallenge);
	const stableOpenQuestionList = useStableCallback(openQuestionList);
	const stableCloseQuestionList = useStableCallback(closeQuestionList);
	const stableToggleTimer = useStableCallback(toggleTimer);
	const stableToggleAnswer = useStableCallback(toggleAnswer);
	const stableJudgeCurrentQuestion = useStableCallback(judgeCurrentQuestion);
	const stableSelectHeaderQuestion = useStableCallback(selectHeaderQuestion);
	const stableSelectListedQuestion = useStableCallback(selectListedQuestion);
	const stableMovePrevious = useStableCallback(movePrevious);
	const stableMoveNext = useStableCallback(moveNext);
	const stableResumeCurrentChallenge = useStableCallback(resumeCurrentChallenge);
	const stableRestartCurrentChallenge = useStableCallback(restartCurrentChallenge);

	return {
		state: renderState,
		phase,
		solutionOpen,
		questionListOpen,
		timerRunning,
		timerStartedAt: runtimeRef.current.lastSample,
		resultPayload,
		resultHistory,
		syncMessage,
		navigationDirection,
		currentQuestionId,
		currentQuestion,
		currentJudgment: currentQuestionId ? renderState?.judgments[currentQuestionId] : undefined,
		currentQuestionElapsedMs: currentQuestionId
			? (renderState?.questionElapsedMs[currentQuestionId] ?? 0)
			: 0,
		currentQuestionIndex,
		navigationLength,
		isFirst,
		isLast,
		totalElapsedMs,
		modeEntryTarget:
			currentQuestionId && renderState
				? isModeEntryTarget(
						props.mode,
						currentQuestionId,
						props.requestedQuestionId,
						renderState.currentIndex,
					)
				: false,
		canFinish: renderState ? isChallengeComplete(renderState) : false,
		startNewChallenge: stableStartNewChallenge,
		finishChallenge: stableFinishChallenge,
		openQuestionList: stableOpenQuestionList,
		closeQuestionList: stableCloseQuestionList,
		toggleTimer: stableToggleTimer,
		toggleAnswer: stableToggleAnswer,
		judgeCurrentQuestion: stableJudgeCurrentQuestion,
		selectHeaderQuestion: stableSelectHeaderQuestion,
		selectListedQuestion: stableSelectListedQuestion,
		movePrevious: stableMovePrevious,
		moveNext: stableMoveNext,
		resumeCurrentChallenge: stableResumeCurrentChallenge,
		restartCurrentChallenge: stableRestartCurrentChallenge,
	};
}
