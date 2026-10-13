import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

import { createTestServer } from "remix/node-fetch-server/test";

import { looksLikeAsset } from "../middleware/assets.ts";
import { router } from "../router.ts";

/**
 * E2E で動かすアプリ（実処理）。
 *
 * 本番の Cloudflare Workers（`app/worker.ts`）と同じ順序でリクエストを処理する:
 *
 *   1. `looksLikeAsset` に該当すれば静的アセットを返す
 *      （本番は Workers Assets バインディング、ここは `public/` の読み出し）
 *   2. それ以外はルーター（本番と同じ `router.fetch`）へ委譲する
 *
 * テスト用の二重実装を避けるため、アセット判定は本番と同じ `looksLikeAsset` を使う。
 */
const PUBLIC_DIR = resolve("public");

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".txt": "text/plain; charset=utf-8",
	".xml": "application/xml",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".pdf": "application/pdf",
};

/** Workers Assets の代わりに `public/` から読む（見つからなければ null → ルーターへ）。 */
async function respondWithAsset(pathname: string): Promise<Response | null> {
	const path = normalize(join(PUBLIC_DIR, pathname));
	if (!path.startsWith(PUBLIC_DIR + sep)) {
		return null;
	}
	try {
		const body = await readFile(path);
		return new Response(body, {
			headers: { "Content-Type": CONTENT_TYPES[extname(path)] ?? "application/octet-stream" },
		});
	} catch {
		return null;
	}
}

export function createAppServer() {
	return createTestServer(async (request: Request) => {
		const url = new URL(request.url);
		if (looksLikeAsset(url.pathname)) {
			const asset = await respondWithAsset(url.pathname);
			if (asset) {
				return asset;
			}
		}
		return router.fetch(request);
	});
}
