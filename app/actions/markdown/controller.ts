import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

const CACHE_CONTROL = 'public, max-age=86400'

/**
 * Markdown API。Stage 7 で既存の `app/features/markdown` を移植する。
 * 現段階ではルート契約とレスポンス形式（Content-Type / Cache-Control）のみ用意する。
 */
export default createController(routes.markdown, {
	actions: {
		index() {
			return new Response('# FIT Redesign\n', {
				headers: {
					'Content-Type': 'text/markdown; charset=utf-8',
					'Cache-Control': CACHE_CONTROL,
				},
			})
		},

		unitYear(context) {
			const body = `# ${context.params.unit} / ${context.params.year}\n`
			return new Response(body, {
				headers: {
					'Content-Type': 'text/markdown; charset=utf-8',
					'Cache-Control': CACHE_CONTROL,
				},
			})
		},
	},
})
