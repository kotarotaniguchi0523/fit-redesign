import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { DeepReadonly } from '../lib/immutable.ts'
import type { Question } from '../types/index.ts'
import type { FigureData } from '../types/index.ts'
import { routes } from '../routes.ts'
import { CopyButton } from '../ui/copy-button.tsx'
import { Document } from './document.tsx'

const mainStyle = css({
	maxWidth: '48rem',
	margin: '0 auto',
	padding: '1rem 1rem 4rem',
})

const cardStyle = css({
	background: 'var(--color-bg-card)',
	border: '1px solid var(--color-border)',
	borderRadius: '0.75rem',
	padding: '1.25rem',
})

const questionTextStyle = css({
	fontSize: '1.05rem',
	lineHeight: 1.8,
	whiteSpace: 'pre-wrap',
	margin: '0 0 1rem',
})

const optionListStyle = css({
	listStyle: 'none',
	margin: '0 0 1rem',
	padding: 0,
	display: 'grid',
	gap: '0.375rem',
})

const optionStyle = css({
	border: '1px solid var(--color-border)',
	borderRadius: '0.375rem',
	padding: '0.5rem 0.75rem',
})

const answerStyle = css({
	marginTop: '1rem',
	paddingTop: '1rem',
	borderTop: '1px solid var(--color-border)',
})

const answerValueStyle = css({
	fontFamily: 'var(--font-mono)',
	fontSize: '1.1rem',
	color: 'var(--color-primary)',
})

const explanationStyle = css({
	whiteSpace: 'pre-wrap',
	color: 'var(--color-text)',
})

const linkStyle = css({
	color: 'var(--color-primary)',
	textDecoration: 'none',
})

export function QuestionPage(
	handle: Handle<{
		unitName: string
		unitId: string
		year: string
		examNumber: number
		examTitle: string
		question: DeepReadonly<Question>
		copyText: string
		currentPath: string
	}>,
) {
	return () => {
		const { unitName, unitId, year, examNumber, examTitle, question, copyText, currentPath } =
			handle.props
		const figure = question.figureData as FigureData | undefined

		return (
			<Document
				title={`問${question.number} ${unitName} ${year} - 基本情報技術 I`}
				description={`${unitName} ${year}年度 ${examTitle} 問${question.number}`}
				currentPath={currentPath}
			>
				<main id="main-content" mix={mainStyle}>
					<p>
						<a mix={linkStyle} href={routes.unitYear.href({ unit: unitId, year })}>
							← {unitName} {year}年度
						</a>
					</p>
					<article mix={cardStyle}>
						<div mix={headerRowStyle}>
							<h1>問{question.number}</h1>
							<CopyButton text={copyText} />
						</div>
						<p mix={questionTextStyle}>{question.text}</p>

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
						{figure ? <Figure data={figure} /> : null}

						<div mix={answerStyle}>
							<h2>答え</h2>
							<p mix={answerValueStyle}>{question.answer}</p>
							{question.explanation ? (
								<>
									<h3>解説</h3>
									<p mix={explanationStyle}>{question.explanation}</p>
								</>
							) : null}
						</div>
					</article>
				</main>
			</Document>
		)
	}
}

/**
 * 図表の描画。Stage 5 では真偽値表とデータ表を Remix コンポーネントで描く。
 * SVG 図（論理回路・状態遷移・フローチャート・二分木・パリティ・ハフマン）は
 * `app/lib/figures` の移植と合わせて順次追加する。
 */
function Figure(handle: Handle<{ data: FigureData }>) {
	return () => {
		const { data } = handle.props
		if (data.type === 'truthTable' || data.type === 'dataTable') {
			return (
				<table mix={tableStyle}>
					<thead>
						<tr>
							{data.columns.map((column) => (
								<th key={column.key}>{column.label}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row, index) => (
							<tr key={index}>
								{data.columns.map((column) => (
									<td key={column.key}>{String(row[column.key] ?? '')}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			)
		}
		return <p>(図: {data.type})</p>
	}
}

const headerRowStyle = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: '0.75rem',
})

const tableStyle = css({
	width: '100%',
	borderCollapse: 'collapse',
	margin: '0 0 1rem',
	fontSize: '0.9rem',
	'& th, & td': {
		border: '1px solid var(--color-border)',
		padding: '0.375rem 0.5rem',
		textAlign: 'center',
	},
})
