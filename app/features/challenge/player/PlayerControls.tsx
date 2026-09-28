import { useLayoutEffect, useState } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import CopyButton from "../../../components/$CopyButton";
import {
	AnswerSheetIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	PauseIcon,
	TimerIcon,
} from "../../../components/icons";
import { formatDuration } from "../challenge";
import { projectElapsedTime } from "./timerRuntime";
import type { PlayerMode } from "./types";

export function QuestionActions({
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
}>): JSX.Element {
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

export function ChallengeTimerDisplay({
	mode,
	totalElapsedMs,
	questionElapsedMs,
	timerRunning,
	timerStartedAt,
}: Readonly<{
	mode: PlayerMode;
	totalElapsedMs: number;
	questionElapsedMs: number;
	timerRunning: boolean;
	timerStartedAt: number | null;
}>): JSX.Element {
	const [now, setNow] = useState(() =>
		typeof performance === "undefined" ? 0 : performance.now(),
	);
	useLayoutEffect(() => {
		if (!timerRunning) {
			return;
		}
		const update = (): void => setNow(performance.now());
		update();
		const interval = window.setInterval(update, 1000);
		return (): void => window.clearInterval(interval);
	}, [timerRunning, timerStartedAt]);
	const displayedTotalMs = projectElapsedTime(totalElapsedMs, timerRunning, timerStartedAt, now);
	const displayedQuestionMs = projectElapsedTime(
		questionElapsedMs,
		timerRunning,
		timerStartedAt,
		now,
	);

	return (
		<fieldset class={`exam-player__timers ${mode === "question" ? "is-single" : ""}`}>
			<legend class="sr-only">経過時間</legend>
			{mode === "exam" ? (
				<div>
					<span>全体</span>
					<strong data-testid="challenge-total-time" aria-live="off">
						{formatDuration(displayedTotalMs)}
					</strong>
				</div>
			) : null}
			<div>
				<span>{mode === "question" ? "計測時間" : "この問題"}</span>
				<strong data-testid="challenge-question-time" aria-live="off">
					{formatDuration(displayedQuestionMs)}
				</strong>
			</div>
		</fieldset>
	);
}

export function PlayerEdgeNavigation({
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
