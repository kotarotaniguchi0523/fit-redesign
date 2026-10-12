import { on } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../../../../routes.ts'
import {
	aggregateChallengeResults,
	formatAccuracy,
	formatDuration,
	summarizeChallenge,
} from '../../challenge.ts'
import type { CompletedChallengePayload } from '../../types.ts'
import type { PlayerMode, PlayerQuestion } from '../types.ts'

const SUCCESS_THRESHOLD = 0.8

/** 完了した試行の結果画面。 */
export function ChallengeResultView(
	handle: Handle<{
		payload: CompletedChallengePayload
		history: readonly CompletedChallengePayload[]
		questions: readonly PlayerQuestion[]
		mode: PlayerMode
		unitId: string
		year: string
		syncMessage: string | null
		onRetry: () => void
	}>,
) {
	return () => {
		const { payload, history, questions, mode, unitId, year, syncMessage, onRetry } = handle.props
		const summary = summarizeChallenge(payload)
		const aggregate = aggregateChallengeResults(history)
		const questionById = new Map(questions.map((question) => [question.id, question]))
		const accuracy = mode === 'exam' ? aggregate.accuracy : summary.accuracy
		const isSuccess = accuracy !== null && accuracy >= SUCCESS_THRESHOLD

		return (
			<section class="exam-result" aria-labelledby="exam-result-title">
				<p class="page-heading__eyebrow">結果</p>
				<h2 id="exam-result-title">
					{isSuccess ? 'よくできました' : 'おつかれさまでした'}
				</h2>

				<dl class="exam-result__stats">
					<div>
						<dt>正答率</dt>
						<dd>{formatAccuracy(accuracy)}</dd>
					</div>
					<div>
						<dt>正解</dt>
						<dd>{summary.correctCount}</dd>
					</div>
					<div>
						<dt>不正解</dt>
						<dd>{summary.incorrectCount}</dd>
					</div>
					<div>
						<dt>合計時間</dt>
						<dd>{formatDuration(summary.totalElapsedMs)}</dd>
					</div>
					{mode === 'exam' && aggregate.challengeCount > 1 ? (
						<div>
							<dt>これまでの試行</dt>
							<dd>{aggregate.challengeCount}回</dd>
						</div>
					) : null}
				</dl>

				<ol class="exam-result__list">
					{payload.answers.map((answer) => {
						const question = questionById.get(answer.questionId)
						return (
							<li key={answer.questionId} class={`is-${answer.judgment}`}>
								<span>{question ? `問${question.number}` : answer.questionId}</span>
								<span>{answer.judgment === 'correct' ? '○' : '×'}</span>
								<span>{formatDuration(answer.elapsedMs)}</span>
							</li>
						)
					})}
				</ol>

				{syncMessage ? <p class="exam-result__sync">{syncMessage}</p> : null}

				<div class="exam-result__actions">
					<button
						type="button"
						class="exam-footer-button exam-footer-button--primary"
						mix={on('click', onRetry)}
					>
						もう一度挑戦する
					</button>
					<a
						class="exam-footer-button exam-footer-button--quiet"
						href={routes.unitYear.href({ unit: unitId, year })}
					>
						問題一覧へ戻る
					</a>
				</div>
			</section>
		)
	}
}
