import { useEffect, useMemo, useReducer, useRef, useState, useViewTransition } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import CopyButton from "../../components/$CopyButton";
import {
	AnswerSheetIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	MenuIcon,
	PauseIcon,
	TimerIcon,
} from "../../components/icons";
import { QuestionContent } from "../../components/QuestionContent";
import { systemClock } from "../../lib/dateTime";
import type { DeepReadonly } from "../../lib/immutable";
import { overlineToHtml } from "../../lib/overline";
import type {
	ChallengeId,
	ExamId,
	ExamNumber,
	Judgment,
	Question,
	QuestionId,
	UnitTabId,
	Year,
} from "../../types";
import { ChallengeIdSchema, EpochMillisecondsSchema, QuestionIdSchema } from "../../types/browser";
import { questionToMarkdown } from "../markdown/questionToMarkdown";
import { recordProgressEntry } from "../progress/progressPersistence";
import { readSyncKey } from "../progress/progressStorage";
import { ChallengeResult } from "./ChallengeResult";
import type { ChallengeAction, TimerRuntime } from "./challenge";
import {
	applyElapsedDelta,
	calculateElapsedDelta,
	challengeReducer,
	createChallengeSnapshot,
	createInitialChallengeState,
	formatDuration,
	isChallengeComplete,
	restoreChallengeState,
	toCompletedChallengePayload,
} from "./challenge";
import { challengeSyncErrorMessage, syncChallenges } from "./challengeApi";
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
} from "./challengeStorage";
import type { ChallengeSnapshot, ChallengeState, CompletedChallengePayload } from "./types";

type PlayerPhase = "player" | "resume" | "result" | "missing" | "locked";
type PlayerQuestion = DeepReadonly<Question>;
type MutableTimerRuntime = { -readonly [Key in keyof TimerRuntime]: TimerRuntime[Key] };

function resetTimerRuntime(runtime: MutableTimerRuntime, questionId: QuestionId | undefined): void {
	if (questionId) {
		runtime.currentQuestionId = questionId;
	}
	runtime.lastSample = null;
	runtime.running = false;
}

function QuestionActions({
	copyText,
	askText,
	answerOpen,
	onToggleAnswer,
	timerRunning,
	onToggleTimer,
}: Readonly<{
	copyText: string;
	askText: string;
	answerOpen: boolean;
	onToggleAnswer: () => void;
	timerRunning: boolean;
	onToggleTimer: () => void;
}>): JSX.Element | null {
	return (
		<fieldset class="exam-player__actions">
			<legend class="sr-only">問題の操作</legend>
			<CopyButton
				text={copyText}
				askText={askText}
				className="exam-action exam-action--copy"
				ariaLabel="問題文をコピー"
				title="問題文をコピー"
				idleLabel="問題文をコピー"
			/>
			<button
				type="button"
				class="exam-action exam-action--answer"
				aria-label={answerOpen ? "解答を隠す" : "解答を表示"}
				title={answerOpen ? "解答を隠す" : "解答を表示"}
				aria-expanded={answerOpen ? "true" : "false"}
				aria-controls={answerOpen ? "exam-answer" : undefined}
				onClick={onToggleAnswer}
			>
				{answerOpen ? <CloseIcon /> : <AnswerSheetIcon />}
			</button>
			<button
				type="button"
				class={`exam-action exam-action--timer ${timerRunning ? "exam-action--timer-running" : ""}`}
				aria-label={timerRunning ? "計測を一時停止" : "計測を再開"}
				title={timerRunning ? "計測を一時停止" : "計測を再開"}
				aria-pressed={timerRunning ? "true" : "false"}
				onClick={onToggleTimer}
			>
				{timerRunning ? <PauseIcon /> : <TimerIcon />}
			</button>
		</fieldset>
	);
}

function ChallengeTimerDisplay({
	mode,
	totalElapsedMs,
	questionElapsedMs,
}: Readonly<{
	mode: Props["mode"];
	totalElapsedMs: number;
	questionElapsedMs: number;
}>): JSX.Element {
	return (
		<fieldset class={`exam-player__timers ${mode === "question" ? "is-single" : ""}`}>
			<legend class="sr-only">経過時間</legend>
			{mode === "exam" ? (
				<div>
					<span>全体</span>
					<strong data-testid="challenge-total-time" aria-live="off">
						{formatDuration(totalElapsedMs)}
					</strong>
				</div>
			) : null}
			<div>
				<span>{mode === "question" ? "計測時間" : "この問題"}</span>
				<strong data-testid="challenge-question-time" aria-live="off">
					{formatDuration(questionElapsedMs)}
				</strong>
			</div>
		</fieldset>
	);
}

function getNavigationPosition(
	mode: Props["mode"],
	currentQuestionId: QuestionId,
	state: ChallengeState,
	questions: readonly PlayerQuestion[],
	getQuestionIndex: (questionId?: QuestionId) => number,
): Readonly<{ currentQuestionIndex: number; navigationLength: number }> {
	return {
		currentQuestionIndex:
			mode === "question" ? getQuestionIndex(currentQuestionId) : state.currentIndex,
		navigationLength: mode === "question" ? questions.length : state.questionIds.length,
	};
}

function PlayerEdgeNavigation({
	showPrevious,
	isFirst,
	isLast,
	canFinish,
	onPrevious,
	onNext,
	onFinish,
}: Readonly<{
	showPrevious: boolean;
	isFirst: boolean;
	isLast: boolean;
	canFinish: boolean;
	onPrevious: () => void;
	onNext: () => void;
	onFinish: () => void;
}>): JSX.Element | null {
	if (!(showPrevious || isLast)) {
		return null;
	}
	return (
		<nav class="exam-player__edge-nav" aria-label="問題移動">
			{showPrevious ? (
				<button
					type="button"
					class="exam-action exam-player__edge-nav-button exam-player__edge-nav-button--previous"
					aria-label="前の問題"
					title="前の問題"
					disabled={isFirst}
					onClick={onPrevious}
				>
					<ChevronLeftIcon />
				</button>
			) : null}
			<button
				type="button"
				class="exam-action exam-player__edge-nav-button exam-player__edge-nav-button--next"
				aria-label={isLast ? "結果を見る" : "次の問題"}
				title={isLast ? "結果を見る" : "次の問題"}
				disabled={isLast && !canFinish}
				onClick={isLast ? onFinish : onNext}
			>
				{isLast ? <CheckIcon /> : <ChevronRightIcon />}
			</button>
		</nav>
	);
}

type Props = Readonly<{
	examId: ExamId;
	examNumber: ExamNumber;
	year: Year;
	unitId: UnitTabId;
	playerTitle: string;
	questions: readonly PlayerQuestion[];
	mode: "exam" | "question";
	requestedQuestionId?: QuestionId;
	initialChallengeId?: ChallengeId;
	initialView: "player" | "result";
}>;

function createPlayerChallenge(
	props: Props,
	questions: readonly PlayerQuestion[],
	scopeKey: string,
	requestedIndex: number | undefined,
	activeQuestionId: QuestionId | undefined,
	getQuestionIndex: (questionId?: QuestionId) => number,
): Readonly<{ state: ChallengeState; question: PlayerQuestion }> | null {
	const requestedQuestionIndex =
		requestedIndex ??
		(props.mode === "question"
			? getQuestionIndex(activeQuestionId ?? props.requestedQuestionId)
			: 0);
	const initialIndex = Math.min(
		Math.max(requestedQuestionIndex, 0),
		Math.max(questions.length - 1, 0),
	);
	const question = questions[initialIndex] ?? questions[0];
	if (!question) {
		return null;
	}
	const questionIds = props.mode === "question" ? [question.id] : questions.map((item) => item.id);
	const challengeScopeKey =
		props.mode === "question" ? questionScopeKey(props.examId, props.mode, question.id) : scopeKey;
	const state = createInitialChallengeState({
		challengeId: generateChallengeId(),
		scopeKey: challengeScopeKey,
		examId: props.examId,
		mode: props.mode,
		questionIds,
		createdAt: systemClock.nowEpochMilliseconds(),
		initialIndex: props.mode === "question" ? 0 : initialIndex,
	});
	return { state, question };
}

type InitialResultView =
	| Readonly<{ kind: "not-result" }>
	| Readonly<{ kind: "missing" }>
	| Readonly<{ kind: "ready"; payload: CompletedChallengePayload }>;

type PlayerAction = ChallengeAction | Readonly<{ type: "INIT"; state: ChallengeState }>;

function playerReducer(state: ChallengeState | null, action: PlayerAction): ChallengeState | null {
	if (action.type === "INIT") {
		return action.state;
	}
	return state ? challengeReducer(state, action) : state;
}

function generateChallengeId(): ChallengeId {
	if (typeof crypto.randomUUID === "function") {
		return ChallengeIdSchema.parse(crypto.randomUUID());
	}
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return ChallengeIdSchema.parse(
		`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
	);
}

function questionScopeKey(examId: string, mode: Props["mode"], questionId?: QuestionId): string {
	return `${examId}/${mode === "question" ? `question/${questionId ?? ""}` : "exam"}`;
}

function isModeEntryTarget(
	mode: Props["mode"],
	currentQuestionId: QuestionId,
	requestedQuestionId: QuestionId | undefined,
	currentIndex: number,
): boolean {
	return mode === "question" ? currentQuestionId === requestedQuestionId : currentIndex === 0;
}

function replaceChallengeView(view: "player" | "result", challengeId?: string): void {
	const url = new URL(window.location.href);
	if (view === "result" && challengeId) {
		url.searchParams.set("view", "result");
		url.searchParams.set("challenge", challengeId);
	} else {
		url.searchParams.delete("view");
		url.searchParams.delete("challenge");
	}
	window.history.replaceState(null, "", url);
}

function replaceQuestionInUrl(questionId: QuestionId): void {
	const url = new URL(window.location.href);
	url.searchParams.set("question", questionId);
	window.history.replaceState(null, "", url);
}

function countJudgments(state: ChallengeState): number {
	return Object.keys(state.judgments).length;
}

function filterChallengeHistory(
	history: readonly CompletedChallengePayload[],
	examId: string,
	mode: Props["mode"],
	requestedQuestionId?: QuestionId,
): CompletedChallengePayload[] {
	return history.filter((item) => {
		if (item.examId !== examId) {
			return false;
		}
		if (mode === "exam") {
			return item.answers.length > 1;
		}
		return item.answers.length === 1 && item.answers[0]?.questionId === requestedQuestionId;
	});
}

function resolveInitialResultView(props: Props): InitialResultView {
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

function AnswerPanel({
	question,
	isOpen,
	judgment,
	onJudge,
}: Readonly<{
	question: PlayerQuestion;
	isOpen: boolean;
	judgment: Judgment | undefined;
	onJudge: (judgment: Judgment) => void;
}>): JSX.Element | null {
	const [hasEntered, setHasEntered] = useState(false);
	useEffect((): (() => void) | undefined => {
		if (!isOpen) {
			setHasEntered(false);
			return;
		}

		const frame = requestAnimationFrame(() => setHasEntered(true));
		return () => cancelAnimationFrame(frame);
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}
	return (
		<section
			class={`exam-answer${hasEntered ? " exam-answer--entered" : ""}`}
			id="exam-answer"
			aria-labelledby="exam-answer-heading"
			aria-live="polite"
		>
			<div class="exam-answer__body" aria-live="polite">
				<h3 class="exam-answer__label" id="exam-answer-heading">
					解答
				</h3>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
				<p dangerouslySetInnerHTML={{ __html: overlineToHtml(question.answer) }} />
				{question.explanation ? (
					<>
						<p class="exam-answer__label">解説</p>
						{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
						<p dangerouslySetInnerHTML={{ __html: overlineToHtml(question.explanation) }} />
					</>
				) : null}
				<fieldset class="exam-judgment">
					<legend class="sr-only">自己判定</legend>
					<button
						type="button"
						class={`judgment-button judgment-button--correct ${judgment === "correct" ? "is-selected" : ""}`}
						aria-label="正解として記録"
						aria-pressed={judgment === "correct" ? "true" : "false"}
						disabled={judgment !== undefined}
						onClick={(): void => onJudge("correct")}
					>
						○
					</button>
					<button
						type="button"
						class={`judgment-button judgment-button--incorrect ${judgment === "incorrect" ? "is-selected" : ""}`}
						aria-label="不正解として記録"
						aria-pressed={judgment === "incorrect" ? "true" : "false"}
						disabled={judgment !== undefined}
						onClick={(): void => onJudge("incorrect")}
					>
						×
					</button>
				</fieldset>
			</div>
		</section>
	);
}

function PlayerListItem({
	question,
	index,
	mode,
	state,
	currentQuestionId,
	onSelect,
}: Readonly<{
	question: PlayerQuestion;
	index: number;
	mode: Props["mode"];
	state: ChallengeState;
	currentQuestionId: QuestionId | undefined;
	onSelect: (index: number) => void;
}>): JSX.Element {
	const judgment = state.judgments[question.id];
	const isCurrent = question.id === currentQuestionId;
	return (
		<li>
			<button
				type="button"
				class={`exam-question-list__item ${mode === "question" ? "exam-question-list__item--focus" : ""} ${isCurrent ? "is-current" : ""}`}
				aria-label={`問${question.number ?? index + 1} ${question.text}`}
				aria-current={isCurrent ? "true" : undefined}
				onClick={(): void => onSelect(index)}
			>
				<span>問{question.number ?? index + 1}</span>
				{mode === "exam" ? (
					<span class="exam-question-list__time">
						{formatDuration(state.questionElapsedMs[question.id] ?? 0)}
					</span>
				) : null}
				{mode === "exam" && judgment ? (
					<span class={`exam-question-list__judgment is-${judgment}`}>
						{judgment === "correct" ? "○" : "×"}
					</span>
				) : null}
				<span class="exam-question-list__prompt">{question.text}</span>
			</button>
		</li>
	);
}

function PlayerList({
	state,
	questions,
	mode,
	open,
	onSelect,
	onClose,
}: Readonly<{
	state: ChallengeState;
	questions: readonly PlayerQuestion[];
	mode: Props["mode"];
	open: boolean;
	onSelect: (index: number) => void;
	onClose: () => void;
}>): JSX.Element | null {
	if (!open) {
		return null;
	}
	const currentQuestionId = state.questionIds[state.currentIndex];
	const listedQuestions =
		mode === "question"
			? questions
			: state.questionIds
					.map((questionId) => questions.find((item) => item.id === questionId))
					.filter((question): question is PlayerQuestion => question !== undefined);
	const totalElapsedMs = Object.values(state.questionElapsedMs).reduce<number>(
		(sum, value) => sum + (value ?? 0),
		0,
	);
	return (
		<>
			<button
				class="exam-question-list__backdrop"
				type="button"
				aria-label="問題一覧を閉じる"
				onClick={onClose}
			/>
			<aside class="exam-question-list" aria-label="問題一覧">
				<div class="exam-question-list__toolbar">
					<div class="exam-question-list__header">
						<h2>問題一覧</h2>
					</div>
					<div class="exam-question-list__actions">
						{mode === "exam" ? (
							<p>
								<span>全体</span>
								<strong>{formatDuration(totalElapsedMs)}</strong>
							</p>
						) : null}
						<button
							type="button"
							class="exam-action"
							aria-label="問題一覧を閉じる"
							title="問題一覧を閉じる"
							onClick={onClose}
						>
							<CloseIcon />
						</button>
					</div>
				</div>
				<ol>
					{listedQuestions.map((question, index) => (
						<PlayerListItem
							key={question.id}
							question={question}
							index={index}
							mode={mode}
							state={state}
							currentQuestionId={currentQuestionId}
							onSelect={onSelect}
						/>
					))}
				</ol>
			</aside>
		</>
	);
}

function PlayerHeader({
	playerTitle,
	questions,
	currentQuestionIndex,
	onOpenQuestionList,
	onSelectQuestion,
}: Readonly<{
	playerTitle: string;
	questions: readonly PlayerQuestion[];
	currentQuestionIndex: number;
	onOpenQuestionList: () => void;
	onSelectQuestion: (index: number) => void;
}>): JSX.Element {
	return (
		<header class="exam-player__header">
			<div class="exam-player__identity">
				{questions.length > 1 ? (
					<button
						type="button"
						class="exam-action exam-player__list-toggle"
						aria-label="問題一覧を開く"
						title="問題一覧を開く"
						onClick={onOpenQuestionList}
					>
						<MenuIcon />
					</button>
				) : null}
				<h2>{playerTitle}</h2>
			</div>
			<nav class="exam-player__progress" aria-label="問題番号">
				<div class="exam-player__progress-steps">
					<ol>
						{questions.map((question, index) => (
							<li key={question.id}>
								<button
									type="button"
									aria-label={`問${index + 1}`}
									aria-current={index === currentQuestionIndex ? "step" : undefined}
									class={index === currentQuestionIndex ? "is-current" : ""}
									onClick={(): void => onSelectQuestion(index)}
								>
									{index + 1}
								</button>
							</li>
						))}
					</ol>
					<div
						class="exam-player__progress-track"
						role="progressbar"
						aria-label="問題の進捗"
						aria-valuemin={0}
						aria-valuemax={questions.length}
						aria-valuenow={currentQuestionIndex + 1}
						aria-valuetext={`問${currentQuestionIndex + 1} / ${questions.length}`}
					>
						<span style={`width: ${((currentQuestionIndex + 1) / questions.length) * 100}%;`} />
					</div>
				</div>
				<span>
					{currentQuestionIndex + 1} / {questions.length}
				</span>
			</nav>
		</header>
	);
}

export default function ExamPlayer(props: Props): JSX.Element {
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
		const activeQuestionId = stateRef.current?.questionIds[stateRef.current.currentIndex];
		const challenge = createPlayerChallenge(
			props,
			questions,
			scopeKey,
			requestedIndex,
			activeQuestionId,
			getQuestionIndex,
		);
		if (!challenge) {
			return;
		}
		const { state: next, question: initialQuestion } = challenge;
		const acquiredLock = tryAcquireChallengeLock(next.challengeId, getOwnerId());
		if (acquiredLock) {
			resetTimerRuntime(runtimeRef.current, next.questionIds[next.currentIndex]);
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
		resetTimerRuntime(runtimeRef.current, next.questionIds[next.currentIndex]);
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
		const history = challengeHistoryForScope(payload);
		setResultHistory(history);
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
		const { payload } = resultView;
		setResultPayload(payload);
		setResultHistory(challengeHistoryForScope(payload));
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

	if (phase === "result" && resultPayload) {
		return (
			<ChallengeResult
				payload={resultPayload}
				history={resultHistory.length > 0 ? resultHistory : [resultPayload]}
				questions={questions}
				mode={props.mode}
				onRetry={(): void => startNewChallenge()}
				onBack={(): void => {
					window.location.href = `/${props.unitId}/${props.year}`;
				}}
				syncMessage={syncMessage}
			/>
		);
	}
	if (phase === "missing") {
		return (
			<div class="exam-player-message">
				<p>この結果は端末内に見つかりませんでした。</p>
				<a
					class="exam-footer-button exam-footer-button--primary"
					href={`/${props.unitId}/${props.year}`}
				>
					問題一覧へ戻る
				</a>
			</div>
		);
	}
	if (phase === "locked") {
		return (
			<section class="exam-resume" aria-labelledby="exam-locked-title">
				<p class="page-heading__eyebrow">別のタブで編集中</p>
				<h2 id="exam-locked-title">この試行は読み取り専用です</h2>
				<p>同じ小テストを開いている別のタブを閉じると、ここから続けられます。</p>
				<div class="exam-resume__actions">
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						onClick={(): void => {
							if (state) {
								resumeChallenge(createChallengeSnapshot(state));
							}
						}}
					>
						もう一度確認する
					</button>
					<a
						class="exam-footer-button exam-footer-button--quiet"
						href={`/${props.unitId}/${props.year}`}
					>
						問題一覧へ戻る
					</a>
				</div>
			</section>
		);
	}
	if (!state) {
		return <div class="exam-player-shell" aria-hidden="true" />;
	}
	if (phase === "resume") {
		return (
			<section class="exam-resume" aria-labelledby="exam-resume-title">
				<p class="page-heading__eyebrow">続きがあります</p>
				<h2 id="exam-resume-title">前回の試行をどうしますか？</h2>
				<div class="exam-resume__actions">
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						onClick={(): void => resumeChallenge(createChallengeSnapshot(state))}
					>
						続きから
					</button>
					<button
						type="button"
						class="exam-footer-button exam-footer-button--quiet"
						onClick={(): void => {
							if (countJudgments(state) > 0) {
								markActiveChallengeIncomplete(state);
							} else {
								discardActiveChallenge(state.challengeId);
							}
							startNewChallenge();
						}}
					>
						最初から
					</button>
				</div>
			</section>
		);
	}

	const currentQuestionId = state.questionIds[state.currentIndex];
	const currentQuestion = questionById.get(currentQuestionId);
	if (!currentQuestion) {
		return <div class="exam-player-message">問題を表示できませんでした。</div>;
	}
	const currentJudgment = state.judgments[currentQuestionId];
	const currentQuestionElapsedMs = state.questionElapsedMs[currentQuestionId] ?? 0;
	const modeEntryTarget = isModeEntryTarget(
		props.mode,
		currentQuestionId,
		props.requestedQuestionId,
		state.currentIndex,
	);
	const totalElapsedMs = Object.values(state.questionElapsedMs).reduce<number>(
		(sum, value) => sum + (value ?? 0),
		0,
	);
	const { currentQuestionIndex, navigationLength } = getNavigationPosition(
		props.mode,
		currentQuestionId,
		state,
		questions,
		getQuestionIndex,
	);
	const isLast = currentQuestionIndex === navigationLength - 1;
	const isFirst = currentQuestionIndex === 0;

	const moveTo = (index: number): void => {
		const current = flushTimer(true);
		if (!current || index < 0 || index >= current.questionIds.length) {
			return;
		}
		setNavigationDirection(index >= state.currentIndex ? "forward" : "backward");
		runtimeRef.current.running = false;
		setTimerRunning(false);
		startViewTransition(() => dispatch({ type: "MOVE_TO", index }));
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
		const selectedQuestionId = state.questionIds[state.currentIndex];
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
		if (!targetQuestion) {
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
		if (!current) {
			return;
		}
		const revealAction = {
			type: "REVEAL_QUESTION" as const,
			questionId: currentQuestionId,
		};
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

	return (
		<section
			class="exam-player-shell"
			aria-label={props.mode === "exam" ? "小テストプレイヤー" : "タイムアタックプレイヤー"}
		>
			<PlayerHeader
				playerTitle={props.playerTitle}
				questions={questions}
				currentQuestionIndex={currentQuestionIndex}
				onOpenQuestionList={openQuestionList}
				onSelectQuestion={(index): void => {
					if (props.mode === "question") {
						moveFocusTo(index);
					} else if (index !== state.currentIndex) {
						moveTo(index);
					}
				}}
			/>
			<PlayerList
				state={state}
				questions={questions}
				mode={props.mode}
				open={questionListOpen}
				onClose={closeQuestionList}
				onSelect={(index): void => {
					if (props.mode === "question") {
						moveFocusTo(index);
					} else if (index === state.currentIndex) {
						closeQuestionList();
					} else {
						setQuestionListOpen(false);
						moveTo(index);
					}
				}}
			/>
			<div class="exam-player__workspace">
				<div
					class={`exam-player__question exam-player__question--${navigationDirection}`}
					data-mode-transition-target={modeEntryTarget ? "" : undefined}
					key={currentQuestionId}
				>
					<QuestionContent question={currentQuestion} variant="exam-player" />
					<ChallengeTimerDisplay
						mode={props.mode}
						totalElapsedMs={totalElapsedMs}
						questionElapsedMs={currentQuestionElapsedMs}
					/>
					<QuestionActions
						copyText={questionToMarkdown(currentQuestion)}
						askText={questionToMarkdown(currentQuestion, { includeSolution: false })}
						answerOpen={solutionOpen}
						onToggleAnswer={toggleAnswer}
						timerRunning={timerRunning}
						onToggleTimer={toggleTimer}
					/>
					<AnswerPanel
						question={currentQuestion}
						isOpen={solutionOpen}
						judgment={currentJudgment}
						onJudge={(judgment): void => {
							if (state.judgments[currentQuestionId]) {
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
						}}
					/>
				</div>
				<PlayerEdgeNavigation
					showPrevious={navigationLength > 1}
					isFirst={isFirst}
					isLast={isLast}
					canFinish={isChallengeComplete(state)}
					onPrevious={(): void => {
						if (props.mode === "question") {
							moveFocusTo(currentQuestionIndex - 1);
						} else {
							moveTo(state.currentIndex - 1);
						}
					}}
					onNext={(): void => {
						if (props.mode === "question") {
							moveFocusTo(currentQuestionIndex + 1);
						} else {
							moveTo(state.currentIndex + 1);
						}
					}}
					onFinish={finishChallenge}
				/>
			</div>
		</section>
	);
}
