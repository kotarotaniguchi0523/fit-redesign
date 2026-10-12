import { del, get, post, route } from 'remix/routes'

/**
 * アプリ全体の URL / メソッド契約。
 *
 * Remix はルートを「URL とメソッドの契約」として routes.ts に集約する。
 * サーバーのコントローラーもブラウザーのモジュールも、同じ route オブジェクトの
 * `href(...)` から型安全に URL を生成する。
 */
export const routes = route({
	home: get('/'),
	guide: get('/guide'),
	records: get('/records'),
	slideOnly: get('/slide-only'),
	health: get('/health'),

	llms: get('/llms.txt'),
	llmsFull: get('/llms-full.txt'),

	markdown: {
		index: get('/markdown'),
		unitYear: get('/markdown/:unit/:year'),
	},

	progress: {
		links: post('/progress/links'),
		sync: post('/progress/sync'),
		challenges: post('/progress/challenges'),
		destroy: del('/progress'),
	},

	unitYear: get('/:unit/:year'),
	exam: get('/:unit/:year/exam/:exam'),
	question: get('/:unit/:year/exam/:exam/question/:question'),
})
