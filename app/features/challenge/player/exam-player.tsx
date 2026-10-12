import {on, clientEntry} from 'remix/component'
import type { Handle } from 'remix/component'

import { systemClock } from '../../../lib/dateTime.ts'
import {
	archiveChallenge,
	archiveCompletedChallenge,
	readCompletedChallenges,
	saveActiveChallenge,
} from '../challengeStorage.ts'
import {
	challengeReducer,
	isChallengeComplete,
	toCompletedChallengePayload,
} from '../challenge.ts'
import type { ChallengeState, CompletedChallengePayload } from '../types.ts'
import { questionToMarkdown } from '../../markdown/questionToMarkdown.ts'
import { resolveInitialPlayerSession } from './initialPlayerSession.ts'
import { filterChallengeHistory, getNavigationPosition } from './model.ts'
import { replaceChallengeView, replaceQuestionInUrl } from './navigation.ts'
import {
	type MutableTimerRuntime,
	resetTimerRuntimeInPlace,
	sampleChallengeTimer,
} from './timerRuntime.ts'
import type { ExamPlayerProps, PlayerMode, PlayerQuestion } from './types.ts'
import { AnswerPanel } from './ui/answer-panel.tsx'
import { ChallengeResultView } from './ui/challenge-result.tsx'
import { QuestionContent } from './ui/question-content.tsx'
import {
	ChallengeTimerDisplay,
	PlayerEdgeNavigation,
	QuestionActions,
} from './ui/player-controls.tsx'
import { PlayerHeader } from './ui/player-header.tsx'
import { PlayerList } from './ui/player-list.tsx'

type Phase = 'player' | 'resume' | 'result' | 'missing' | 'locked'

/**
 * 小テストプレイヤー（clientEntry）。
 *
 * Remix Way: 状態はこのコンポーネントの setup スコープに置き、変更時に `handle.update()`
 * を呼んで再描画する。子コンポーネントは props だけの無状態コンポーネント。
 * 永続化は localStorage（challengeStorage）、ドメイン規則は純関数（challenge/model/timerRuntime）。
 */
export const ExamPlayer = clientEntry(
	'/assets/client.js#ExamPlayer',
	function ExamPlayer(handle: Handle<ExamPlayerProps>) {
		const props = handle.props
		const questionById = new Map(props.questions.map((question) => [question.id, question]))
		const questionIndexById = new Map(
			props.questions.map((question, index) => [question.id, index]),
		)

		const session = resolveInitialPlayerSession(props)
		let state: ChallengeState | null = session.state
		let phase: Phase = session.phase
		let resultPayload: CompletedChallengePayload | null = session.resultPayload
		let resultHistory: readonly CompletedChallengePayload[] = session.resultHistory
		let solutionOpen = false
		let questionListOpen = false
		let navigationDirection: 'forward' | 'backward' = 'forward'
		let syncMessage: string | null = null

		const runtime: MutableTimerRuntime = {
			running: false,
			lastSample: null,
			currentQuestionId: (state ? state.questionIds[state.currentIndex] : undefined) as never,
		}

		const now = () => systemClock.nowEpochMilliseconds()

		const currentQuestionId = () => state?.questionIds[state.currentIndex]
		const currentQuestion = (): PlayerQuestion | undefined => {
			const id = currentQuestionId()
			return id ? questionById.get(id) : undefined
		}
		const navigation = () =>
			state
				? getNavigationPosition(props.mode, currentQuestionId() as never, state, props.questions, (id) =>
						id ? (questionIndexById.get(id) ?? 0) : 0,
					)
				: { currentQuestionIndex: 0, navigationLength: props.questions.length }

		const persist = () => {
			if (state) {
				saveActiveChallenge(state)
			}
		}

		/** 計測中の経過を取り込んでから状態を差し替える。 */
		const commit = (next: ChallengeState) => {
			const sampled = sampleChallengeTimer(next, runtime as never, now())
			state = sampled.state
			persist()
		}

		const sample = () => {
			if (!state) return
			const sampled = sampleChallengeTimer(state, runtime as never, now())
			state = sampled.state
			persist()
		}

		const openAnswer = () => {
			solutionOpen = true
			if (state) {
				const id = currentQuestionId()
				if (id) {
					state = challengeReducer(state, { type: 'REVEAL_QUESTION', questionId: id })
					persist()
				}
			}
		}

		const toggleAnswer = () => {
			if (solutionOpen) {
				solutionOpen = false
			} else {
				openAnswer()
			}
			void handle.update()
		}

		const toggleTimer = () => {
			sample()
			if (runtime.running) {
				runtime.running = false
			} else {
				runtime.running = true
				runtime.lastSample = now()
			}
			void handle.update()
		}

		const judge = (judgment: 'correct' | 'incorrect') => {
			if (!state) return
			const id = currentQuestionId()
			if (!id) return
			sample()
			if (!state) return
			const judged = challengeReducer(state, {
				type: 'JUDGE_QUESTION',
				questionId: id,
				judgment,
				answerCreatedAt: now(),
			})
			solutionOpen = false
			commit(judged)
			void handle.update()
		}

		const selectIndex = (index: number, listed: boolean) => {
			if (!state) return
			sample()
			if (!state) return
			const targetId = listed
				? (state.questionIds[index] ?? currentQuestionId())
				: (props.questions[index]?.id ?? currentQuestionId())
			if (!targetId || !state) return
			const moveIndex = listed ? index : (questionIndexById.get(targetId) ?? 0)
			const fromIndex = navigation().currentQuestionIndex
			navigationDirection = moveIndex >= fromIndex ? 'forward' : 'backward'
			state = challengeReducer(state, { type: 'MOVE_TO', index: moveIndex })
			resetTimerRuntimeInPlace(runtime, currentQuestionId())
			runtime.running = true
			runtime.lastSample = now()
			solutionOpen = false
			questionListOpen = false
			persist()
			if (props.mode === 'question') {
				replaceQuestionInUrl(targetId)
			}
			void handle.update()
		}

		const move = (offset: number) => {
			const { currentQuestionIndex, navigationLength } = navigation()
			const next = currentQuestionIndex + offset
			if (next < 0 || next >= navigationLength) return
			selectIndex(next, props.mode === 'question')
			void handle.update()
		}

		const finish = () => {
			if (!state) return
			sample()
			if (!state) return
			const updatedAt = now()
			const completed = challengeReducer(state as never, { type: 'COMPLETE', updatedAt })
			const archived = archiveCompletedChallenge(completed, updatedAt)
			if (!archived) return
			const payload = archived.payload
			resultPayload = payload
			resultHistory = filterChallengeHistory(
				readCompletedChallenges(),
				props.examId,
				props.mode,
				props.mode === 'question'
					? (payload.answers[0]?.questionId ?? props.requestedQuestionId)
					: props.requestedQuestionId,
			)
			phase = 'result'
			solutionOpen = false
			if (typeof window !== 'undefined') {
				replaceChallengeView('result', payload.challengeId)
			}
			void handle.update()
		}

		const retry = () => {
			if (typeof window === 'undefined') return
			replaceChallengeView('player')
			const reload = resolveInitialPlayerSession(props)
			state = reload.state
			phase = reload.phase
			resultPayload = null
			resultHistory = []
			solutionOpen = false
			resetTimerRuntimeInPlace(runtime, currentQuestionId())
			runtime.running = true
			runtime.lastSample = now()
			persist()
			void handle.update()
		}

		const resume = () => {
			phase = 'player'
			runtime.running = true
			runtime.lastSample = now()
			void handle.update()
		}

		return () => {
			const syncMessageValue = syncMessage
			void syncMessageValue

			if (!state && typeof window === 'undefined') {
				return <ExamPlayerPreview props={props} />
			}

			if (phase === 'result' && resultPayload) {
				return (
					<ChallengeResultView
						payload={resultPayload}
						history={resultHistory.length > 0 ? resultHistory : [resultPayload]}
						questions={props.questions}
						mode={props.mode}
						unitId={props.unitId}
						year={props.year}
						syncMessage={syncMessage}
						onRetry={retry}
					/>
				)
			}

			if (phase === 'missing') {
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
				)
			}

			if (!state) {
				return <ExamPlayerPreview props={props} />
			}

			if (phase === 'resume') {
				return (
					<section class="exam-resume" aria-labelledby="exam-resume-title">
						<p class="page-heading__eyebrow">続きがあります</p>
						<h2 id="exam-resume-title">前回の試行をどうしますか？</h2>
						<div class="exam-resume__actions">
							<button
								type="button"
								class="exam-footer-button exam-footer-button--primary"
								mix={on('click', resume)}
							>
								続きから
							</button>
							<button
								type="button"
								class="exam-footer-button exam-footer-button--quiet"
								mix={on('click', retry)}
							>
								最初から
							</button>
						</div>
					</section>
				)
			}

			const question = currentQuestion()
			if (!question) {
				return <div class="exam-player-message">問題を表示できませんでした。</div>
			}

			const { currentQuestionIndex, navigationLength } = navigation()
			const markdown = questionToMarkdown(question, { includeSolution: false })
			const currentJudgment = state.judgments[question.id]

			return (
				<section
					class="exam-player-shell"
					aria-label={props.mode === 'exam' ? '小テストプレイヤー' : 'タイムアタックプレイヤー'}
				>
					<PlayerHeader
						playerTitle={props.playerTitle}
						questions={props.questions}
						currentQuestionIndex={currentQuestionIndex}
						onOpenQuestionList={() => {
							questionListOpen = true
							void handle.update()
						}}
						onSelectQuestion={(index) => selectIndex(index, false)}
					/>
					<PlayerList
						state={state}
						questions={props.questions}
						mode={props.mode}
						open={questionListOpen}
						onClose={() => {
							questionListOpen = false
							void handle.update()
						}}
						onSelect={(index) => selectIndex(index, true)}
					/>
					<div class="exam-player__workspace">
						<div class={`exam-player__question exam-player__question--${navigationDirection}`}>
							<QuestionContent question={question} />
							<ChallengeTimerDisplay
								mode={props.mode}
								totalElapsedMs={Object.values(state.questionElapsedMs).reduce<number>(
									(sum, value) => sum + (value ?? 0),
									0,
								)}
								questionElapsedMs={state.questionElapsedMs[question.id] ?? 0}
								timerRunning={runtime.running}
								timerStartedAt={runtime.running ? runtime.lastSample : null}
							/>
							<QuestionActions
								copyText={markdown}
								answerOpen={solutionOpen}
								onToggleAnswer={toggleAnswer}
								timerRunning={runtime.running}
								onToggleTimer={toggleTimer}
							/>
							<AnswerPanel
								question={question}
								isOpen={solutionOpen}
								judgment={currentJudgment}
								onJudge={judge}
							/>
						</div>
						<PlayerEdgeNavigation
							showPrevious={navigationLength > 1}
							isFirst={currentQuestionIndex === 0}
							isLast={currentQuestionIndex === navigationLength - 1}
							canFinish={isChallengeComplete(state)}
							onPrevious={() => move(-1)}
							onNext={() => move(1)}
							onFinish={finish}
						/>
					</div>
				</section>
			)
		}
	},
)

/** サーバー描画時とハイドレーション前の静的なプレビュー。 */
function ExamPlayerPreview(handle: Handle<{ props: ExamPlayerProps }>) {
	return () => {
		const { props } = handle.props
		const question = props.questions[0]
		if (!question) {
			return <div class="exam-player-shell" aria-hidden="true" />
		}
		return (
			<section
				class="exam-player-shell"
				aria-label={props.mode === 'exam' ? '小テストプレイヤー' : 'タイムアタックプレイヤー'}
			>
				<PlayerHeader
					playerTitle={props.playerTitle}
					questions={props.questions}
					currentQuestionIndex={0}
					disabled
					onOpenQuestionList={() => {}}
					onSelectQuestion={() => {}}
				/>
				<div class="exam-player__workspace">
					<div class="exam-player__question">
						<QuestionContent question={question} />
						<ChallengeTimerDisplay
							mode={props.mode}
							totalElapsedMs={0}
							questionElapsedMs={0}
							timerRunning={false}
							timerStartedAt={null}
						/>
					</div>
				</div>
			</section>
		)
	}
}

export type { PlayerMode }
