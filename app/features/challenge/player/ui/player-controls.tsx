import type { Handle } from "remix/component";
import { css, on, ref } from "remix/component";

import { CopyButton } from "../../../../ui/copy-button.tsx";
import { formatDuration } from "../../challenge.ts";
import { projectElapsedTime } from "../timerRuntime.ts";
import type { PlayerMode } from "../types.ts";
import {
	AnswerSheetIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	PauseIcon,
	TimerIcon,
} from "./icons.tsx";

const actionStyle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "2.25rem",
	height: "2.25rem",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	background: "var(--color-bg-card)",
	color: "var(--color-primary)",
	cursor: "pointer",
	"&:hover": { background: "var(--color-primary-soft)" },
	"&:disabled": { cursor: "default", opacity: 0.5 },
});

const actionsRowStyle = css({
	display: "flex",
	alignItems: "center",
	gap: "0.5rem",
	border: 0,
	margin: "0.75rem 0 0",
	padding: 0,
});

const timersStyle = css({
	display: "flex",
	gap: "1rem",
	margin: "0.75rem 0 0",
	border: 0,
	padding: 0,
	"& div": { display: "flex", alignItems: "baseline", gap: "0.375rem" },
	"& span": { fontSize: "0.8rem", color: "var(--color-text-muted)" },
	"& strong": { fontFamily: "var(--font-mono)", fontSize: "1rem" },
});

const edgeNavStyle = css({
	display: "flex",
	justifyContent: "space-between",
	marginTop: "1rem",
});

/** 問題の操作（コピー / 解答表示 / タイマー）。 */
export function QuestionActions(
	handle: Handle<{
		copyText: string;
		answerOpen: boolean;
		onToggleAnswer: () => void;
		timerRunning: boolean;
		onToggleTimer: () => void;
	}>,
) {
	return () => {
		const { copyText, answerOpen, onToggleAnswer, timerRunning, onToggleTimer } = handle.props;

		return (
			<fieldset mix={actionsRowStyle}>
				<legend class="sr-only">問題の操作</legend>
				<CopyButton text={copyText} label="問題文をコピー" />
				<button
					type="button"
					mix={[actionStyle, on("click", onToggleAnswer)]}
					aria-label={answerOpen ? "解答を隠す" : "解答を表示"}
					title={answerOpen ? "解答を隠す" : "解答を表示"}
					aria-expanded={answerOpen ? "true" : "false"}
					aria-controls={answerOpen ? "exam-answer" : undefined}
				>
					{answerOpen ? <CloseIcon /> : <AnswerSheetIcon />}
				</button>
				<button
					type="button"
					mix={[actionStyle, on("click", onToggleTimer)]}
					aria-label={timerRunning ? "計測を一時停止" : "計測を再開"}
					title={timerRunning ? "計測を一時停止" : "計測を再開"}
					aria-pressed={timerRunning ? "true" : "false"}
					style={timerRunning ? { borderColor: "var(--color-accent)" } : undefined}
				>
					{timerRunning ? <PauseIcon /> : <TimerIcon />}
				</button>
			</fieldset>
		);
	};
}

/**
 * 経過時間の表示。Remix には effect が無いため、`ref` ミニクスで DOM への
 * attach / detach に合わせて 1 秒間隔の更新を開始・停止する。
 */
export function ChallengeTimerDisplay(
	handle: Handle<{
		mode: PlayerMode;
		totalElapsedMs: number;
		questionElapsedMs: number;
		timerRunning: boolean;
		timerStartedAt: number | null;
	}>,
) {
	let now = 0;
	let interval: ReturnType<typeof setInterval> | undefined;

	const stopTicking = () => {
		if (interval !== undefined) {
			clearInterval(interval);
			interval = undefined;
		}
	};

	const syncTicking = (running: boolean) => {
		if (!running) {
			stopTicking();
			return;
		}
		if (interval === undefined) {
			now = typeof performance === "undefined" ? 0 : performance.now();
			interval = setInterval(() => {
				now = performance.now();
				void handle.update();
			}, 1000);
		}
	};

	return () => {
		const { mode, totalElapsedMs, questionElapsedMs, timerRunning, timerStartedAt } = handle.props;
		const displayedTotalMs = projectElapsedTime(totalElapsedMs, timerRunning, timerStartedAt, now);
		const displayedQuestionMs = projectElapsedTime(
			questionElapsedMs,
			timerRunning,
			timerStartedAt,
			now,
		);

		return (
			<fieldset
				mix={[
					timersStyle,
					ref((node) => {
						if (node) {
							syncTicking(timerRunning);
						} else {
							stopTicking();
						}
					}),
				]}
			>
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
	};
}

/** 前後移動 + 完了。 */
export function PlayerEdgeNavigation(
	handle: Handle<{
		showPrevious: boolean;
		isFirst: boolean;
		isLast: boolean;
		canFinish: boolean;
		onPrevious: () => void;
		onNext: () => void;
		onFinish: () => void;
	}>,
) {
	return () => {
		const { showPrevious, isFirst, isLast, canFinish, onPrevious, onNext, onFinish } = handle.props;

		if (!(showPrevious || isLast)) {
			return null;
		}

		return (
			<nav aria-label="問題移動" mix={edgeNavStyle}>
				{showPrevious ? (
					<button
						type="button"
						mix={[actionStyle, on("click", onPrevious)]}
						aria-label="前の問題"
						title="前の問題"
						disabled={isFirst}
					>
						<ChevronLeftIcon />
					</button>
				) : (
					<span />
				)}
				<button
					type="button"
					mix={[actionStyle, on("click", isLast ? onFinish : onNext)]}
					aria-label={isLast ? "結果を見る" : "次の問題"}
					title={isLast ? "結果を見る" : "次の問題"}
					disabled={isLast && !canFinish}
				>
					{isLast ? <CheckIcon /> : <ChevronRightIcon />}
				</button>
			</nav>
		);
	};
}
