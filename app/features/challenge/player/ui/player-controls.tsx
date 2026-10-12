import {on, ref} from 'remix/component'
import type { Handle } from 'remix/component'

import { formatDuration } from '../../challenge.ts'
import type { PlayerMode } from '../types.ts'
import { projectElapsedTime } from '../timerRuntime.ts'
import { CopyButton } from '../../../../ui/copy-button.tsx'
import {
	AnswerSheetIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	PauseIcon,
	TimerIcon,
} from './icons.tsx'

/** 問題の操作（コピー / 解答表示 / タイマー）と、経過時間のライブ表示。 */
export function QuestionActions(
	handle: Handle<{
		copyText: string
		answerOpen: boolean
		onToggleAnswer: () => void
		timerRunning: boolean
		onToggleTimer: () => void
	}>,
) {
	return () => {
		const { copyText, answerOpen, onToggleAnswer, timerRunning, onToggleTimer } = handle.props

		return (
			<fieldset class="exam-player__actions">
				<legend class="sr-only">問題の操作</legend>
				<CopyButton text={copyText} label="問題文をコピー" />
				<button
					type="button"
					class="exam-action exam-action--answer"
					aria-label={answerOpen ? '解答を隠す' : '解答を表示'}
					title={answerOpen ? '解答を隠す' : '解答を表示'}
					aria-expanded={answerOpen ? 'true' : 'false'}
					aria-controls={answerOpen ? 'exam-answer' : undefined}
					mix={on('click', onToggleAnswer)}
				>
					{answerOpen ? <CloseIcon /> : <AnswerSheetIcon />}
				</button>
				<button
					type="button"
					class={`exam-action exam-action--timer ${timerRunning ? 'exam-action--timer-running' : ''}`}
					aria-label={timerRunning ? '計測を一時停止' : '計測を再開'}
					title={timerRunning ? '計測を一時停止' : '計測を再開'}
					aria-pressed={timerRunning ? 'true' : 'false'}
					mix={on('click', onToggleTimer)}
				>
					{timerRunning ? <PauseIcon /> : <TimerIcon />}
				</button>
			</fieldset>
		)
	}
}

/**
 * 経過時間の表示。Remix には effect が無いため、`ref` ミニクスで
 * DOM への attach / detach に合わせて 1 秒間隔の更新を開始・停止する。
 */
export function ChallengeTimerDisplay(
	handle: Handle<{
		mode: PlayerMode
		totalElapsedMs: number
		questionElapsedMs: number
		timerRunning: boolean
		timerStartedAt: number | null
	}>,
) {
	let now = 0
	let interval: ReturnType<typeof setInterval> | undefined

	const stopTicking = () => {
		if (interval !== undefined) {
			clearInterval(interval)
			interval = undefined
		}
	}

	const syncTicking = (running: boolean) => {
		if (!running) {
			stopTicking()
			return
		}
		if (interval === undefined) {
			now = typeof performance === 'undefined' ? 0 : performance.now()
			interval = setInterval(() => {
				now = performance.now()
				void handle.update()
			}, 1000)
		}
	}

	return () => {
		const { mode, totalElapsedMs, questionElapsedMs, timerRunning, timerStartedAt } = handle.props
		const displayedTotalMs = projectElapsedTime(totalElapsedMs, timerRunning, timerStartedAt, now)
		const displayedQuestionMs = projectElapsedTime(
			questionElapsedMs,
			timerRunning,
			timerStartedAt,
			now,
		)

		return (
			<fieldset
				mix={ref((node) => {
					if (node) {
						syncTicking(timerRunning)
					} else {
						stopTicking()
					}
				})}
				class={`exam-player__timers ${mode === 'question' ? 'is-single' : ''}`}
			>
				<legend class="sr-only">経過時間</legend>
				{mode === 'exam' ? (
					<div>
						<span>全体</span>
						<strong data-testid="challenge-total-time" aria-live="off">
							{formatDuration(displayedTotalMs)}
						</strong>
					</div>
				) : null}
				<div>
					<span>{mode === 'question' ? '計測時間' : 'この問題'}</span>
					<strong data-testid="challenge-question-time" aria-live="off">
						{formatDuration(displayedQuestionMs)}
					</strong>
				</div>
			</fieldset>
		)
	}
}

/** 前後移動 + 完了。 */
export function PlayerEdgeNavigation(
	handle: Handle<{
		showPrevious: boolean
		isFirst: boolean
		isLast: boolean
		canFinish: boolean
		onPrevious: () => void
		onNext: () => void
		onFinish: () => void
	}>,
) {
	return () => {
		const { showPrevious, isFirst, isLast, canFinish, onPrevious, onNext, onFinish } =
			handle.props

		if (!(showPrevious || isLast)) {
			return null
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
						mix={on('click', onPrevious)}
					>
						<ChevronLeftIcon />
					</button>
				) : null}
				<button
					type="button"
					class="exam-action exam-player__edge-nav-button exam-player__edge-nav-button--next"
					aria-label={isLast ? '結果を見る' : '次の問題'}
					title={isLast ? '結果を見る' : '次の問題'}
					disabled={isLast && !canFinish}
					mix={on('click', isLast ? onFinish : onNext)}
				>
					{isLast ? <CheckIcon /> : <ChevronRightIcon />}
				</button>
			</nav>
		)
	}
}
