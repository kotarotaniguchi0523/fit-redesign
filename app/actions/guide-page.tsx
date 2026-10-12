import { css, unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'

import { guideHtml } from '../content/guide.generated.ts'
import { PageHeading } from '../ui/PageHeading.tsx'
import { Document } from './document.tsx'

const mainStyle = css({ maxWidth: '48rem', margin: '0 auto', padding: '1rem 1rem 4rem' })

const articleStyle = css({
	background: 'var(--color-bg-card)',
	border: '1px solid var(--color-border)',
	borderRadius: '0.75rem',
	padding: '1.5rem',
	'& h1': { fontSize: '1.6rem', marginTop: 0 },
	'& h2': { fontSize: '1.2rem', marginTop: '1.5rem' },
	'& h3': { fontSize: '1.05rem', marginTop: '1.25rem' },
	'& p, & li': { lineHeight: 1.9 },
	'& a': { color: 'var(--color-primary)' },
	'& code': {
		fontFamily: 'var(--font-mono)',
		background: 'var(--color-primary-soft)',
		padding: '0.1rem 0.3rem',
		borderRadius: '0.25rem',
	},
})

/** 使い方ガイド。`scripts/build-guide.mjs` が生成した HTML を描画する。 */
export function GuidePage(handle: Handle<{ currentPath: string }>) {
	return () => (
		<Document title="使い方ガイド - 基本情報技術 I" currentPath={handle.props.currentPath}>
			<main id="main-content" mix={mainStyle}>
				<PageHeading eyebrow="ガイド" title="使い方ガイド" />
				<article mix={articleStyle} innerHTML={unsafeHTML(guideHtml)} />
			</main>
		</Document>
	)
}
