import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { unitBasedTabs } from '../data/units.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'

const latestYear = '2017'

const mainStyle = css({
	width: '100%',
	maxWidth: '960px',
	margin: '0 auto',
	padding: '24px 16px 64px',
})

const headerStyle = css({
	display: 'flex',
	alignItems: 'baseline',
	justifyContent: 'space-between',
	gap: '16px',
	flexWrap: 'wrap',
	marginBottom: '8px',
})

const titleStyle = css({
	fontSize: '28px',
	fontWeight: 800,
	letterSpacing: '-0.02em',
	margin: 0,
})

const leadStyle = css({
	color: '#475569',
	margin: '0 0 24px',
})

const listStyle = css({
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
	gap: '12px',
	listStyle: 'none',
	margin: 0,
	padding: 0,
})

const cardStyle = css({
	display: 'block',
	padding: '16px',
	border: '1px solid #e2e8f0',
	borderRadius: '12px',
	background: '#ffffff',
	color: 'inherit',
	textDecoration: 'none',
	transition: 'border-color 120ms ease, box-shadow 120ms ease',
	'&:hover': {
		borderColor: '#2563eb',
		boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
	},
})

const cardTitleStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	fontSize: '16px',
	fontWeight: 700,
	margin: '0 0 4px',
})

const cardDescStyle = css({
	margin: 0,
	fontSize: '13px',
	color: '#64748b',
})

export function HomePage(handle: Handle) {
	return () => {
		void handle

		return (
			<Document
				title="FIT Redesign — 情報処理技術者試験の過去問"
				description="明治大学「基本情報技術 I」の過去の小テストを単元と年度から探して、問題・解答・解説を確認できるサイトです。"
			>
				<main mix={mainStyle}>
					<header mix={headerStyle}>
						<h1 mix={titleStyle}>FIT Redesign</h1>
					</header>
					<p mix={leadStyle}>
						単元を選んで、年度ごとの小テストを確認できます。
					</p>
					<ul mix={listStyle}>
						{unitBasedTabs.map((unit) => {
							const latest = unit.examMapping.at(-1)
							const year = latest?.year ?? latestYear

							return (
								<li key={unit.id}>
									<a
										mix={cardStyle}
										href={routes.unitYear.href({ unit: unit.id, year })}
									>
										<h2 mix={cardTitleStyle}>
											<span aria-hidden="true">{unit.icon}</span>
											{unit.name}
										</h2>
										<p mix={cardDescStyle}>{unit.description}</p>
									</a>
								</li>
							)
						})}
					</ul>
				</main>
			</Document>
		)
	}
}
