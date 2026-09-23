import { useEffect, useMemo, useReducer, useRef, useState, useViewTransition } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { Figure } from "../../components/figures/Figure";
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

type PlayerPhase = "player" | "resume" | "list" | "result" | "missing" | "locked";
type PlayerQuestion = DeepReadonly<Question>;
type MutableTimerRuntime = { -readonly [Key in keyof TimerRuntime]: TimerRuntime[Key] };

type Props = Readonly<{
	examId: ExamId;
	examNumber: ExamNumber;
	year: Year;
	unitId: UnitTabId;
	questions: readonly PlayerQuestion[];
	mode: "exam" | "question";
	requestedQuestionId?: QuestionId;
	initialChallengeId?: ChallengeId;
	initialView: "player" | "result";
}>;

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

function countJudgments(state: ChallengeState): number {
	return Object.keys(state.judgments).length;
}

function QuestionBody({ question }: Readonly<{ question: PlayerQuestion }>): JSX.Element {
	return (
		<>
			<div class="exam-question__number">問{question.number}</div>
			<div
				class="exam-question__text"
				/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */
				dangerouslySetInnerHTML={{ __html: overlineToHtml(question.text) }}
			/>
			{question.figureData ? (
				<div class="exam-question__figure">
					<Figure data={question.figureData as NonNullable<Question["figureData"]>} />
				</div>
			) : null}
			{!question.figureData && question.figureDescription ? (
				<p class="exam-question__figure-fallback">
					<strong>図:</strong> {question.figureDescription}
				</p>
			) : null}
			{question.options?.length ? (
				<ol class="exam-question__options" aria-label="選択肢">
					{question.options.map((option) => (
						<li>
							<span class="exam-question__option-label">{option.label}</span>
							{/* biome-ignore lint/security/noDangerouslySetInnerHtml: overlineToHtmlで生成した限定HTML */}
							<span dangerouslySetInnerHTML={{ __html: overlineToHtml(option.value) }} />
						</li>
					))}
				</ol>
			) : null}
		</>
	);
}

function AnswerPanel({
	question,
	isOpen,
	judgment,
	onToggle,
	onJudge,
}: Readonly<{
	question: PlayerQuestion;
	isOpen: boolean;
	judgment: Judgment | undefined;
	onToggle: (event: Event) => void;
	onJudge: (judgment: Judgment) => void;
}>): JSX.Element {
	return (
		<details class="exam-answer" open={isOpen} onToggle={onToggle}>
			<summary class="exam-answer__toggle">{isOpen ? "閉じる" : "答えを確認"}</summary>
			<div class="exam-answer__body" aria-live="polite">
				<p class="exam-answer__label">解答</p>
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
		</details>
	);
}

function PlayerList({
	state,
	questions,
	onSelect,
}: Readonly<{
	state: ChallengeState;
	questions: readonly PlayerQuestion[];
	onSelect: (index: number) => void;
}>): JSX.Element {
	return (
		<section class="exam-question-list" aria-label="問題一覧">
			<div class="exam-question-list__header">
				<h2>問題一覧</h2>
				<p>判定済みの問題は色で確認できます。</p>
			</div>
			<ol>
				{state.questionIds.map((questionId, index) => {
					const question = questions.find((item) => item.id === questionId);
					const judgment = state.judgments[questionId];
					return (
						<li>
							<button
								type="button"
								class={`exam-question-list__item ${index === state.currentIndex ? "is-current" : ""}`}
								onClick={(): void => onSelect(index)}
							>
								<span>問{question?.number ?? index + 1}</span>
								<span class="exam-question-list__time">
									{formatDuration(state.questionElapsedMs[questionId] ?? 0)}
								</span>
								{judgment ? (
									<span class={`exam-question-list__judgment is-${judgment}`}>
										{judgment === "correct" ? "○" : "×"}
									</span>
								) : null}
							</button>
						</li>
					);
				})}
			</ol>
		</section>
	);
}

export default function ExamPlayer(props: Props): JSX.Element {
	const { questions } = props;
	const [state, dispatch] = useReducer(playerReducer, null);
	const [phase, setPhase] = useState<PlayerPhase>(
		props.initialView === "result" ? "result" : "player",
	);
	const [solutionOpen, setSolutionOpen] = useState(false);
	const [resultPayload, setResultPayload] = useState<CompletedChallengePayload | null>(null);
	const [resultHistory, setResultHistory] = useState<readonly CompletedChallengePayload[]>([]);
	const [syncMessage, setSyncMessage] = useState<string | null>(null);
	const stateRef = useRef<ChallengeState | null>(null);
	const phaseRef = useRef<PlayerPhase>(phase);
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

	const startNewChallenge = (initialIndex = 0): void => {
		const createdAt = systemClock.nowEpochMilliseconds();
		const next = createInitialChallengeState({
			challengeId: generateChallengeId(),
			scopeKey,
			examId: props.examId,
			mode: props.mode,
			questionIds: questions.map((question) => question.id),
			createdAt,
			initialIndex,
		});
		if (!tryAcquireChallengeLock(next.challengeId, getOwnerId())) {
			dispatch({ type: "INIT", state: next });
			setPhase("locked");
			return;
		}
		saveActiveChallenge(next);
		lastPersistAt.current = typeof performance === "undefined" ? 0 : performance.now();
		dispatch({ type: "INIT", state: next });
		setResultPayload(null);
		setPhase("player");
		replaceChallengeView("player");
	};

	const resumeChallenge = (snapshot: ChallengeSnapshot): void => {
		const next = createChallengeStateFromSnapshot(snapshot);
		dispatch({ type: "INIT", state: next });
		setResultPayload(null);
		setPhase(tryAcquireChallengeLock(next.challengeId, getOwnerId()) ? "player" : "locked");
	};

	const challengeHistoryForScope = (
		payload: CompletedChallengePayload,
	): CompletedChallengePayload[] =>
		readCompletedChallenges().filter((item) => {
			if (item.examId !== payload.examId) {
				return false;
			}
			if (props.mode === "exam") {
				return item.answers.length > 1;
			}
			return item.answers.length === 1 && item.answers[0]?.questionId === props.requestedQuestionId;
		});

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
						merged.filter((item) => {
							if (item.examId !== props.examId) {
								return false;
							}
							return props.mode === "exam"
								? item.answers.length > 1
								: item.answers.length === 1 &&
										item.answers[0]?.questionId === props.requestedQuestionId;
						}),
					);
				},
				(error) => setSyncMessage(challengeSyncErrorMessage(error)),
			);
		}
	};

	const initializeResultView = (): boolean => {
		if (props.initialView !== "result") {
			return false;
		}
		if (!props.initialChallengeId) {
			setPhase("missing");
			return true;
		}
		const snapshot = findChallenge(props.initialChallengeId);
		if (snapshot?.status !== "completed") {
			setPhase("missing");
			return true;
		}
		const restored = restoreChallengeState(snapshot);
		const payload = toCompletedChallengePayload(restored, snapshot.updatedAt);
		if (!payload) {
			setPhase("missing");
			return true;
		}
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
		startNewChallenge(0);
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
			runtimeRef.current.running = document.visibilityState === "visible";
			runtimeRef.current.lastSample = performance.now();
		}
		setSolutionOpen(false);
	}, [phase, state?.currentIndex]);

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
				if (flushed) {
					saveActiveChallenge(flushed);
				}
			} else if (phaseRef.current === "player") {
				runtimeRef.current.lastSample = performance.now();
				runtimeRef.current.running = true;
			}
		};
		const onPageHide = (): void => {
			const flushed = flushTimer(true);
			if (flushed) {
				saveActiveChallenge(flushed);
			}
			runtimeRef.current.running = false;
		};
		const onPageShow = (): void => {
			if (phaseRef.current === "player" && document.visibilityState === "visible") {
				runtimeRef.current.lastSample = performance.now();
				runtimeRef.current.running = true;
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
	}, []);

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
	const isLast = state.currentIndex === state.questionIds.length - 1;
	const isFirst = state.currentIndex === 0;

	const moveTo = (index: number): void => {
		const current = flushTimer(true);
		if (!current || index < 0 || index >= current.questionIds.length) {
			return;
		}
		runtimeRef.current.running = false;
		startViewTransition(() => dispatch({ type: "MOVE_TO", index }));
		persistState({ ...current, currentIndex: index }, true);
	};
	const openQuestionList = (): void => {
		const current = flushTimer(true);
		if (current) {
			saveActiveChallenge(current);
		}
		runtimeRef.current.running = false;
		setPhase("list");
	};
	if (phase === "list") {
		return (
			<PlayerList
				state={state}
				questions={questions}
				onSelect={(index): void => {
					setPhase("player");
					moveTo(index);
				}}
			/>
		);
	}

	return (
		<section class="exam-player-shell" aria-label="小テストプレイヤー">
			<header class="exam-player__header">
				<div>
					<p class="exam-player__eyebrow">
						{props.mode === "question" ? "単問計測" : `小テスト${props.examNumber}`}
					</p>
					<h2>
						問{state.currentIndex + 1}
						<span> / {state.questionIds.length}</span>
					</h2>
				</div>
				<fieldset class="exam-player__timers">
					<legend class="sr-only">経過時間</legend>
					<div>
						<span>全体</span>
						<strong>
							{formatDuration(
								Object.values(state.questionElapsedMs).reduce<number>(
									(sum, value) => sum + (value ?? 0),
									0,
								),
							)}
						</strong>
					</div>
					<div>
						<span>この問題</span>
						<strong>{formatDuration(state.questionElapsedMs[currentQuestionId] ?? 0)}</strong>
					</div>
				</fieldset>
			</header>
			<div class="exam-player__question" key={currentQuestionId}>
				<QuestionBody question={currentQuestion} />
				<AnswerPanel
					question={currentQuestion}
					isOpen={solutionOpen}
					judgment={currentJudgment}
					onToggle={(event: Event): void => {
						if (!(event.currentTarget instanceof HTMLDetailsElement)) {
							return;
						}
						setSolutionOpen(event.currentTarget.open);
						if (event.currentTarget.open) {
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
							const timestamp = EpochMillisecondsSchema.safeParse(
								systemClock.nowEpochMilliseconds(),
							);
							if (!timestamp.success) {
								return;
							}
							recordProgressEntry({
								questionId: currentQuestionId,
								unitId: props.unitId,
								createdAt: timestamp.data,
								updatedAt: timestamp.data,
							});
						}
					}}
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
			<footer class="exam-player__footer">
				<button
					type="button"
					class="exam-footer-button exam-footer-button--quiet"
					disabled={isFirst}
					onClick={(): void => moveTo(state.currentIndex - 1)}
				>
					前の問題
				</button>
				<button
					type="button"
					class="exam-footer-button exam-footer-button--quiet"
					onClick={openQuestionList}
				>
					問題一覧
				</button>
				{isLast ? (
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						disabled={!isChallengeComplete(state)}
						onClick={finishChallenge}
					>
						結果を見る
					</button>
				) : (
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						onClick={(): void => moveTo(state.currentIndex + 1)}
					>
						次の問題
					</button>
				)}
			</footer>
		</section>
	);
}
