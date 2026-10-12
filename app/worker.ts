import { looksLikeAsset } from './middleware/assets.ts'
import { router } from './router.ts'

/**
 * Cloudflare Workers エントリポイント。
 *
 * Remix のルーターは `Request → Response` を返す Fetch ハンドラなので、
 * Workers では `router.fetch(request)` をそのまま委譲するだけでよい
 * （公式ガイド "Alternate runtimes: Bun, Deno, Workers" の Workers 版）。
 *
 * 静的アセットは Workers Assets（`env.ASSETS`）へ委譲する。バインド（DB /
 * PROGRESS_RATE_LIMITER）は必要になった時点で `cloudflare:workers` の `env`
 * から取得する（Stage 4 以降）。
 */
export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url)

		if (looksLikeAsset(url.pathname)) {
			const assetResponse = await env.ASSETS.fetch(request)
			if (assetResponse.status !== 404) {
				return assetResponse
			}
		}

		try {
			return await router.fetch(request)
		} catch (error) {
			console.error('Unhandled error while fetching', request.url, error)
			return new Response('Internal Server Error', { status: 500 })
		}
	},
} satisfies ExportedHandler<Env>
