import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import { Document } from './document.tsx'

const mainStyle = css({
	width: '100%',
	maxWidth: '720px',
	margin: '0 auto',
	padding: '64px 16px',
	textAlign: 'center',
})

const codeStyle = css({
	fontSize: '48px',
	fontWeight: 800,
	letterSpacing: '-0.04em',
	margin: '0 0 8px',
})

const linkStyle = css({
	color: '#2563eb',
})

export function NotFoundPage(handle: Handle<{ path?: string }>) {
	return () => (
		<Document title="ページが見つかりません — FIT Redesign">
			<main mix={mainStyle}>
				<p mix={codeStyle}>404</p>
				<h1>ページが見つかりません</h1>
				{handle.props.path ? <p>{handle.props.path}</p> : null}
				<p>
					<a mix={linkStyle} href={routes.home.href()}>
						トップへ戻る
					</a>
				</p>
			</main>
		</Document>
	)
}
