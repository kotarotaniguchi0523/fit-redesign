import {
	createPortal,
	flushSync,
	useEffect,
	useMemo,
	useOptimistic,
	useReducer,
	useRef,
	useTransition,
} from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { ClockIcon, GearIcon } from "../../components/icons";
import {
	ALERT_SOUND,
	DEFAULT_TARGET_TIME,
	TARGET_TIME_PRESETS,
	TIMER_INTERVAL_MS,
} from "../../constants";
import type { QuestionId } from "../../types";
import { formatTime } from "./timeFormat";
import { clearQuestionRecords, loadTimerData, saveAttempt } from "./timerStorage";
import type { AttemptRecord, TimerMode } from "./types";

interface QuestionTimerProps {
	questionId: string;
}

interface PopoverPosition {
	top: number;
	left: number;
}

interface TimerState {
	mode: TimerMode;
	elapsedSeconds: number;
	isRunning: boolean;
	isCompleted: boolean;
	targetTime: number;
	attempts: AttemptRecord[];
	settingsOpen: boolean;
	portalReady: boolean;
	popoverPosition: PopoverPosition;
}

type TimerAction =
	| { type: "portalReady" }
	| { type: "hydrateAttempts"; attempts: AttemptRecord[] }
	| { type: "appendAttempt"; attempt: AttemptRecord }
	| { type: "clearAttempts" }
	| { type: "tick" }
	| { type: "start" }
	| { type: "stop" }
	| { type: "complete" }
	| { type: "reset"; mode?: TimerMode }
	| { type: "setMode"; mode: TimerMode }
	| { type: "setTargetTime"; targetTime: number }
	| { type: "toggleSettings" }
	| { type: "closeSettings" }
	| { type: "setPopoverPosition"; position: PopoverPosition };

const INITIAL_STATE: TimerState = {
	mode: "stopwatch",
	elapsedSeconds: 0,
	isRunning: false,
	isCompleted: false,
	targetTime: DEFAULT_TARGET_TIME,
	attempts: [],
	settingsOpen: false,
	portalReady: typeof document !== "undefined",
	popoverPosition: { top: 0, left: 8 },
};

function reducer(state: TimerState, action: TimerAction): TimerState {
	switch (action.type) {
		case "portalReady":
			return { ...state, portalReady: true };
		case "hydrateAttempts":
			return { ...state, attempts: action.attempts };
		case "appendAttempt":
			return { ...state, attempts: [...state.attempts, action.attempt] };
		case "clearAttempts":
			return { ...state, attempts: [] };
		case "tick":
			if (state.mode === "stopwatch") {
				return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
			}
			if (state.elapsedSeconds <= 1) {
				return { ...state, elapsedSeconds: 0, isRunning: false, isCompleted: true };
			}
			return { ...state, elapsedSeconds: state.elapsedSeconds - 1 };
		case "start":
			return { ...state, isRunning: true, isCompleted: false };
		case "stop":
			return { ...state, isRunning: false };
		case "complete":
			return { ...state, isRunning: false, isCompleted: true };
		case "reset": {
			const mode = action.mode ?? state.mode;
			return {
				...state,
				mode,
				isRunning: false,
				isCompleted: false,
				elapsedSeconds: mode === "countdown" ? state.targetTime : 0,
			};
		}
		case "setMode":
			return {
				...state,
				mode: action.mode,
				isRunning: false,
				isCompleted: false,
				elapsedSeconds: action.mode === "countdown" ? state.targetTime : 0,
			};
		case "setTargetTime":
			return {
				...state,
				targetTime: action.targetTime,
				elapsedSeconds: state.mode === "countdown" ? action.targetTime : state.elapsedSeconds,
			};
		case "toggleSettings":
			return { ...state, settingsOpen: !state.settingsOpen };
		case "closeSettings":
			return { ...state, settingsOpen: false };
		case "setPopoverPosition":
			return { ...state, popoverPosition: action.position };
		default:
			return state;
	}
}

function playAlertSound(): void {
	try {
		const ctx = new AudioContext();
		if (ctx.state === "suspended") {
			ctx.resume().catch(() => {
				/* AudioContext 未対応環境は無視 */
			});
		}
		const playTone = (frequency: number): void => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.frequency.value = frequency;
			osc.type = "sine";
			gain.gain.value = ALERT_SOUND.GAIN;
			osc.start();
			osc.stop(ctx.currentTime + ALERT_SOUND.DURATION);
		};
		playTone(ALERT_SOUND.FIRST_FREQUENCY);
		setTimeout(() => {
			playTone(ALERT_SOUND.SECOND_FREQUENCY);
			ctx.close().catch(() => {
				/* AudioContext 未対応環境は無視 */
			});
		}, ALERT_SOUND.SECOND_DELAY);
	} catch {
		// AudioContext not supported.
	}
}

function loadAttempts(questionId: string): AttemptRecord[] {
	const loadResult = loadTimerData();
	if (!loadResult.ok) {
		return [];
	}
	return loadResult.value.records[questionId as QuestionId]?.attempts ?? [];
}

interface TimerDisplayClasses {
	display: string;
	icon: string;
	text: string;
}

function displayClasses(isRunning: boolean, isCompleted: boolean): TimerDisplayClasses {
	if (isCompleted) {
		return {
			display:
				"flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors bg-red-100 border-red-500 animate-pulse",
			icon: "w-4 h-4 shrink-0 text-red-700 font-bold inline-flex",
			text: "text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-red-700 font-bold",
		};
	}
	if (isRunning) {
		return {
			display:
				"flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors bg-blue-100 border-blue-400",
			icon: "w-4 h-4 shrink-0 text-blue-700 inline-flex",
			text: "text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-blue-700",
		};
	}
	return {
		display:
			"flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors bg-slate-100 border-slate-200",
		icon: "w-4 h-4 shrink-0 text-slate-700 inline-flex",
		text: "text-sm font-mono font-semibold tabular-nums whitespace-nowrap text-slate-700",
	};
}

function attemptDuration(mode: TimerMode, elapsedSeconds: number, targetTime: number): number {
	return mode === "stopwatch" ? elapsedSeconds : targetTime - elapsedSeconds;
}

function modeButtonClass(active: boolean): string {
	return active
		? "px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors"
		: "px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";
}

function presetButtonClass(active: boolean, disabled: boolean): string {
	if (disabled) {
		return "px-3 py-1.5 text-sm font-medium rounded-xl text-slate-400 border border-slate-200 cursor-not-allowed transition-colors";
	}
	return active
		? "px-3 py-1.5 text-sm font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 transition-colors"
		: "px-3 py-1.5 text-sm font-medium rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors";
}

export default function QuestionTimer({ questionId }: QuestionTimerProps): JSX.Element {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const hasSavedRef = useRef(false);
	const completedSavedRef = useRef(false);
	const [isPending, startTransition] = useTransition();
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
	const [optimisticAttempts, addOptimisticAttempt] = useOptimistic<AttemptRecord[], AttemptRecord>(
		state.attempts,
		(current, attempt) => [...current, attempt],
	);
	const apply = (action: TimerAction): void => flushSync(() => dispatch(action));

	const visibleAttempts = isPending ? optimisticAttempts : state.attempts;
	const spentSeconds = attemptDuration(state.mode, state.elapsedSeconds, state.targetTime);
	const classes = displayClasses(state.isRunning, state.isCompleted);

	const stats = useMemo(() => {
		if (visibleAttempts.length === 0) {
			return { last: "--:--", average: "--:--", count: "0回" };
		}
		const last = visibleAttempts[visibleAttempts.length - 1].duration;
		const avg =
			visibleAttempts.reduce((sum, attempt) => sum + attempt.duration, 0) / visibleAttempts.length;
		return {
			last: formatTime(last),
			average: formatTime(Math.round(avg)),
			count: `${visibleAttempts.length}回`,
		};
	}, [visibleAttempts]);

	const timeText = useMemo(() => {
		const current = formatTime(state.elapsedSeconds);
		if (state.mode === "countdown" && !state.isRunning && !state.isCompleted) {
			return `${current} / ${formatTime(state.targetTime)}`;
		}
		return current;
	}, [state.elapsedSeconds, state.isCompleted, state.isRunning, state.mode, state.targetTime]);

	function stopClock(): void {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}

	function startClock(): void {
		stopClock();
		intervalRef.current = setInterval(() => {
			if (!rootRef.current?.isConnected) {
				stopClock();
				return;
			}
			apply({ type: "tick" });
		}, TIMER_INTERVAL_MS);
	}

	function persistAttempt(duration: number, completed: boolean): void {
		if (hasSavedRef.current || duration <= 0) {
			return;
		}
		const attempt: AttemptRecord = {
			timestamp: Date.now(),
			duration,
			mode: state.mode,
			completed,
			targetTime: state.targetTime,
		};
		hasSavedRef.current = true;
		addOptimisticAttempt(attempt);
		startTransition(() => {
			saveAttempt(questionId as QuestionId, attempt);
			apply({ type: "appendAttempt", attempt });
		});
	}

	function reset(mode = state.mode): void {
		hasSavedRef.current = false;
		completedSavedRef.current = false;
		stopClock();
		apply({ type: "reset", mode });
	}

	function updatePopoverPosition(): void {
		const button = settingsButtonRef.current;
		if (!button) {
			return;
		}
		const rect = button.getBoundingClientRect();
		apply({
			type: "setPopoverPosition",
			position: {
				top: Math.max(8, rect.top - 8),
				left: Math.max(8, rect.right - 320),
			},
		});
	}

	useEffect(() => {
		// localStorage からの復元のみ（サーバー同期は廃止。タイマーは端末ローカル専用）。
		apply({ type: "hydrateAttempts", attempts: loadAttempts(questionId) });

		return (): void => {
			stopClock();
		};
	}, [questionId]);

	useEffect(() => {
		if (
			!(
				state.mode === "countdown" &&
				state.isCompleted &&
				!completedSavedRef.current &&
				state.targetTime > 0
			)
		) {
			return;
		}
		completedSavedRef.current = true;
		stopClock();
		playAlertSound();
		persistAttempt(state.targetTime, true);
	}, [state.isCompleted, state.mode, state.targetTime]);

	useEffect(() => {
		if (!state.settingsOpen) {
			return;
		}
		updatePopoverPosition();
		window.addEventListener("resize", updatePopoverPosition);
		window.addEventListener("scroll", updatePopoverPosition, true);
		return (): void => {
			window.removeEventListener("resize", updatePopoverPosition);
			window.removeEventListener("scroll", updatePopoverPosition, true);
		};
	}, [state.settingsOpen]);

	return (
		<div
			ref={rootRef}
			data-question-timer
			data-question-id={questionId}
			data-elapsed={String(spentSeconds)}
			class="relative"
		>
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class={`min-w-max whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold text-white transition-colors ${
						state.isRunning ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
					}`}
					onClick={(): void => {
						if (state.isRunning) {
							stopClock();
							apply({ type: "stop" });
							persistAttempt(spentSeconds, state.isCompleted);
							return;
						}
						hasSavedRef.current = false;
						completedSavedRef.current = false;
						apply({ type: "start" });
						startClock();
					}}
				>
					{state.isRunning ? "停止" : "開始"}
				</button>

				<button
					type="button"
					class={`rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 ${
						state.isRunning ? "" : "hidden"
					}`}
					onClick={(): void => reset()}
				>
					リセット
				</button>

				<div class={classes.display}>
					<ClockIcon className={classes.icon} />
					<span class={classes.text}>{timeText}</span>
				</div>

				<button
					ref={settingsButtonRef}
					type="button"
					class="rounded-lg p-1.5 transition-colors hover:bg-white"
					aria-label="タイマー設定"
					onClick={(event): void => {
						event.stopPropagation();
						apply({ type: "toggleSettings" });
					}}
				>
					<GearIcon
						className={`w-5 h-5 text-slate-500 inline-flex transition-transform duration-200 ${
							state.settingsOpen ? "rotate-45" : ""
						}`}
					/>
				</button>
			</div>

			{state.portalReady
				? createPortal(
						<>
							<button
								type="button"
								aria-label="タイマー設定を閉じる"
								class={`fixed inset-0 z-40 ${state.settingsOpen ? "" : "hidden"}`}
								onClick={(): void => apply({ type: "closeSettings" })}
							/>
							<div
								class={`fixed w-80 p-0 border border-slate-200 shadow-lg rounded-xl bg-white z-50 ${
									state.settingsOpen ? "" : "hidden"
								}`}
								style={`top:${state.popoverPosition.top}px;left:${state.popoverPosition.left}px`}
							>
								<div class="p-3 space-y-3">
									<div>
										<p class="text-xs font-semibold text-slate-600 mb-2">タイマーモード</p>
										<div class="flex gap-1">
											<button
												type="button"
												class={modeButtonClass(state.mode === "stopwatch")}
												onClick={(): void => {
													if (state.mode === "stopwatch") {
														return;
													}
													hasSavedRef.current = false;
													completedSavedRef.current = false;
													stopClock();
													apply({ type: "setMode", mode: "stopwatch" });
												}}
											>
												ストップウォッチ
											</button>
											<button
												type="button"
												class={modeButtonClass(state.mode === "countdown")}
												onClick={(): void => {
													if (state.mode === "countdown") {
														return;
													}
													hasSavedRef.current = false;
													completedSavedRef.current = false;
													stopClock();
													apply({ type: "setMode", mode: "countdown" });
												}}
											>
												カウントダウン
											</button>
										</div>
									</div>

									<div class={state.mode === "countdown" ? "" : "hidden"}>
										<p class="text-xs font-semibold text-slate-600 mb-2">目標時間</p>
										<div class="flex gap-1 flex-wrap">
											{TARGET_TIME_PRESETS.map((preset) => (
												<button
													type="button"
													class={presetButtonClass(
														state.targetTime === preset.value,
														state.isRunning,
													)}
													disabled={state.isRunning}
													onClick={(): void => {
														if (state.isRunning) {
															return;
														}
														apply({ type: "setTargetTime", targetTime: preset.value });
													}}
												>
													{preset.label}
												</button>
											))}
										</div>
									</div>

									<div>
										<p class="text-xs font-semibold text-slate-600 mb-2">統計</p>
										<div class="grid grid-cols-3 gap-1">
											<StatCard label="前回" value={stats.last} />
											<StatCard label="平均" value={stats.average} />
											<StatCard label="回数" value={stats.count} />
										</div>
									</div>

									<button
										type="button"
										class="px-3 py-1.5 text-sm font-medium rounded-xl text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										disabled={visibleAttempts.length === 0}
										onClick={(): void => {
											clearQuestionRecords(questionId as QuestionId);
											startTransition(() => apply({ type: "clearAttempts" }));
										}}
									>
										履歴をクリア
									</button>
								</div>
							</div>
						</>,
						document.body,
					)
				: null}
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
	return (
		<div class="bg-slate-50 rounded p-2 text-center">
			<div class="text-xs text-slate-500">{label}</div>
			<div class="font-mono font-semibold text-slate-800 text-sm">{value}</div>
		</div>
	);
}
