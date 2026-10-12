import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

/**
 * 学習記録の同期 API。Stage 4（data-table + D1）と Stage 7 で実装する。
 * 現段階ではルート契約のみ確保する。
 */
export default createController(routes.progress, {
	actions: {
		links() {
			return new Response('Not Implemented', { status: 501 })
		},

		sync() {
			return new Response('Not Implemented', { status: 501 })
		},

		challenges() {
			return new Response('Not Implemented', { status: 501 })
		},

		destroy() {
			return new Response('Not Implemented', { status: 501 })
		},
	},
})
