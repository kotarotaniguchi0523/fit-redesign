import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

import { createTestServer } from "remix/node-fetch-server/test";

import { router } from "../router.ts";

/**
 * E2E 用のアプリサーバー。
 *
 * 本番（app/worker.ts）は Workers Assets（env.ASSETS）へ委譲するが、E2E は
 * `router.fetch` を直接起動するため、そのままでは `/assets/client.js` や
 * `/style.css` が配信されず島が hydrate しない。ここで `public/` の静的配信を
 * 前置きしてからルーターへ渡す（本番の構成をテストで再現する）。
 */
const PUBLIC_DIR = resolve("public");

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".txt": "text/plain; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json",
};

async function readPublicFile(pathname: string): Promise<Response | null> {
	const path = normalize(join(PUBLIC_DIR, pathname));
	// public/ の外へ出るパスは配信しない
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
		if (request.method === "GET" && extname(url.pathname) !== "") {
			const asset = await readPublicFile(url.pathname);
			if (asset) {
				return asset;
			}
		}
		return router.fetch(request);
	});
}
