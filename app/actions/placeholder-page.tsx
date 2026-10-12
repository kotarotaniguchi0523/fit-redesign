import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import { Document } from './document.tsx'

const mainStyle = css({
	width: '100%',
	maxWidth: '800px',
	margin: '0 auto',
	padding: '48px 16px',
})

const linkStyle = css({
	color: '#2563eb',
})

export function PlaceholderPage(handle: Handle<{ title: string; currentPath?: string }>) {
	return () => (
		<Document title={`${handle.props.title} — 基本情報技術 I`} currentPath={handle.props.currentPath}>
			<main mix={mainStyle}>
				<h1>{handle.props.title}</h1>
				<p>このページは Remix 3 移行の途中です。</p>
				<p>
					<a mix={linkStyle} href={routes.home.href()}>
						トップへ戻る
					</a>
				</p>
			</main>
		</Document>
	)
}
