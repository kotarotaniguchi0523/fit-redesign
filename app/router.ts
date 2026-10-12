import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { createRouter } from 'remix/router'
import type { RouterContext } from 'remix/router'

import controller from './actions/controller.tsx'
import markdownController from './actions/markdown/controller.ts'
import progressController from './actions/progress/controller.ts'
import { loadDatabase } from './middleware/database.ts'
import { securityHeaders } from './middleware/security.ts'
import { routes } from './routes.ts'

/**
 * アプリのルーター。ミドルウェアの順序は「依存する側の前に提供する側」を置く。
 *
 * 1. logger          … リクエストログ
 * 2. securityHeaders … レスポンスへセキュリティヘッダーを付与
 * 3. formData        … フォームボディの解析
 * 4. render          … Remix コンポーネントの描画（context.render）
 *
 * ここには Node / Workers 固有の依存を入れない。静的アセットの委譲は Workers
 * エントリ（app/worker.ts）が担い、ルーターは Node でもテストできる状態に保つ。
 */
export const router = createRouter({
	middleware: [logger(), securityHeaders(), loadDatabase(), formData(), render()],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
	interface RouterTypes {
		context: AppContext
	}
}

router.map(routes, controller)
router.map(routes.markdown, markdownController)
router.map(routes.progress, progressController)
