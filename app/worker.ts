import { env } from "cloudflare:workers";

import { createD1Database } from "./db/d1.ts";
import { setDatabase, setRateLimiter } from "./db/registry.ts";
import { looksLikeAsset } from "./middleware/assets.ts";
import { router } from "./router.ts";

/**
 * Cloudflare Workers エントリポイント。
 *
 * Remix のルーターは `Request → Response` を返す Fetch ハンドラなので、
 * Workers では `router.fetch(request)` をそのまま委譲するだけでよい
 * （公式ガイド "Alternate runtimes: Bun, Deno, Workers" の Workers 版）。
 *
 * D1 バインディングから data-table の Database を構築してレジストリへ登録し、
 * ミドルウェアがリクエストコンテキストへ載せる。静的アセットは Workers Assets
 * （`env.ASSETS`）へ委譲する。
 */
setDatabase(createD1Database(env.DB));
setRateLimiter(env.PROGRESS_RATE_LIMITER);

export default {
	async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (looksLikeAsset(url.pathname)) {
			const assetResponse = await env.ASSETS.fetch(request);
			if (assetResponse.status !== 404) {
				return assetResponse;
			}
		}

		try {
			return await router.fetch(request);
		} catch (error) {
			console.error("Unhandled error while fetching", request.url, error);
			return new Response("Internal Server Error", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
