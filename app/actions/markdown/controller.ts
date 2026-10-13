import { createController } from "remix/router";

import { renderMarkdown } from "../../features/markdown/markdownContent.ts";
import { routes } from "../../routes.ts";

const CACHE_CONTROL = "public, max-age=86400";

/**
 * Markdown API。旧 `app/routes/markdown.ts`（Hono + etag ミドルウェア）を移植。
 * ETag / If-None-Match による 304 は `remix/headers` の ETag 契約に合わせて実装する。
 */
async function respond(path: string, request: Request): Promise<Response> {
	const { status, body } = await renderMarkdown(path);
	if (status !== 200) {
		return new Response(body, { status });
	}

	const etag = `"${await weakEtag(body)}"`;
	if (request.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { etag } });
	}

	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": CACHE_CONTROL,
			etag,
		},
	});
}

async function weakEtag(body: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default createController(routes.markdown, {
	actions: {
		index(context) {
			return respond("", context.request);
		},

		unitYear(context) {
			return respond(`${context.params.unit}/${context.params.year}`, context.request);
		},
	},
});
