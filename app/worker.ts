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

/** ブラウザーモジュールの拡張子（アセットサーバーの出力はアンバンドル ESM）。 */
const MODULE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const MODULE_CONTENT_TYPE = "text/javascript; charset=utf-8";

/**
 * アセットサーバーの出力（`.ts` / `.tsx` のままの URL）は実行可能な MIME で返す。
 * Workers Assets は拡張子から MIME を決めるため、そのままではモジュールとして
 * 読み込まれない（Chrome は `application/octet-stream` を拒否する）。
 */
function asModuleResponse(response: Response, pathname: string): Response {
	const dot = pathname.lastIndexOf(".");
	if (dot === -1 || !MODULE_EXTENSIONS.has(pathname.slice(dot))) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set("Content-Type", MODULE_CONTENT_TYPE);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default {
	async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (looksLikeAsset(url.pathname)) {
			const assetResponse = await env.ASSETS.fetch(request);
			if (assetResponse.status !== 404) {
				return asModuleResponse(assetResponse, url.pathname);
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
