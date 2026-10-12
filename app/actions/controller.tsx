import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'
import { PlaceholderPage } from './placeholder-page.tsx'

/**
 * ルートコントローラー。`routes.ts` の直下のルートリーフを担当する。
 * 入れ子のルートマップ（markdown / progress）は別コントローラーが持つ。
 */
export default createController(routes, {
	actions: {
		home(context) {
			return context.render(<HomePage />)
		},

		guide(context) {
			return context.render(<PlaceholderPage title="利用ガイド" />)
		},

		records(context) {
			return context.render(<PlaceholderPage title="学習記録" />)
		},

		slideOnly(context) {
			return context.render(<PlaceholderPage title="講義スライド" />)
		},

		unitYear(context) {
			return context.render(
				<PlaceholderPage
					title={`${context.params.unit} / ${context.params.year}`}
				/>,
			)
		},

		exam(context) {
			return context.render(
				<PlaceholderPage title={`${context.params.unit} / ${context.params.year} / exam ${context.params.exam}`} />,
			)
		},

		question(context) {
			return context.render(
				<PlaceholderPage
					title={`${context.params.unit} / ${context.params.year} / exam ${context.params.exam} / question ${context.params.question}`}
				/>,
				{ status: 200 },
			)
		},

		health() {
			return Response.json({ status: 'ok' })
		},

		llms() {
			return new Response('llms.txt placeholder', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			})
		},

		llmsFull() {
			return new Response('llms-full.txt placeholder', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			})
		},
	},
})
