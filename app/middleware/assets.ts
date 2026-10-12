/**
 * 静的アセット配信の Workers 判定。
 *
 * `remix/middleware/static` は Node の `fs` 前提で Workers では動かないため、
 * Workers Assets バインディング（`env.ASSETS`）へ委譲する。
 * `runWorkerFirst: true` なので全リクエストが Worker へ来る。
 */
const ASSET_PREFIX = "/assets/";

const ASSET_EXTENSIONS = new Set([
	".js",
	".mjs",
	".css",
	".map",
	".svg",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".avif",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".otf",
	".txt",
	".xml",
	".json",
	".webmanifest",
	".pdf",
]);

export function looksLikeAsset(pathname: string): boolean {
	if (pathname.startsWith(ASSET_PREFIX)) {
		return true;
	}
	const lastDot = pathname.lastIndexOf(".");
	if (lastDot <= 0 || lastDot < pathname.lastIndexOf("/")) {
		return false;
	}
	return ASSET_EXTENSIONS.has(pathname.slice(lastDot).toLowerCase());
}
