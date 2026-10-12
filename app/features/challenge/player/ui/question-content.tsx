import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { Figure } from '../../../../ui/figures/Figure.tsx'
import type { PlayerQuestion } from '../types.ts'

const bodyStyle = css({
	'& p': { whiteSpace: 'pre-wrap', lineHeight: 1.9 },
})

const optionListStyle = css({
	listStyle: 'none',
	margin: '1rem 0',
	padding: 0,
	display: 'grid',
	gap: '0.375rem',
})

const optionStyle = css({
	border: '1px solid var(--color-border)',
	borderRadius: '0.375rem',
	padding: '0.5rem 0.75rem',
})

/** プレイヤー内の問題表示（問題文・選択肢・図）。解答は AnswerPanel が担当する。 */
export function QuestionContent(handle: Handle<{ question: PlayerQuestion }>) {
	return () => {
		const { question } = handle.props
		return (
			<div class="exam-question" mix={bodyStyle}>
				<h3 class="exam-question__heading">問{question.number}</h3>
				<p>{question.text}</p>
				{question.options ? (
					<ul mix={optionListStyle}>
						{question.options.map((option) => (
							<li key={option.label} mix={optionStyle}>
								<strong>{option.label}</strong>: {option.value}
							</li>
						))}
					</ul>
				) : null}
				{question.figureDescription ? <p>{question.figureDescription}</p> : null}
				{question.figureData ? <Figure data={question.figureData as never} /> : null}
			</div>
		)
	}
}
