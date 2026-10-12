import { css } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

export interface DocumentProps {
	children?: RemixNode
	head?: RemixNode
	title?: string
	description?: string
}

const htmlStyle = css({
	margin: 0,
	fontFamily:
		"'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', system-ui, -apple-system, sans-serif",
	color: '#111827',
	background: '#f8fafc',
	lineHeight: 1.7,
})

const bodyStyle = css({
	margin: 0,
	minHeight: '100vh',
	display: 'flex',
	flexDirection: 'column',
})

/**
 * すべてのページが通る Document シェル。
 * Remix は `css()` のルールをサーバー描画時に収集し、<head> へ挿入する。
 */
export function Document(handle: Handle<DocumentProps>) {
	return () => {
		const { children, head, title = 'FIT Redesign', description } = handle.props

		return (
			<html lang="ja" mix={htmlStyle}>
				<head>
					<meta charSet="UTF-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta name="color-scheme" content="light" />
					<title>{title}</title>
					{description ? <meta name="description" content={description} /> : null}
					{head}
				</head>
				<body mix={bodyStyle}>{children}</body>
			</html>
		)
	}
}
