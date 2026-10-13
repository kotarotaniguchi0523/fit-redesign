import type { Middleware } from "remix/router";

/**
 * セキュリティヘッダー。旧 `app/server/securityHeaders.ts`（Hono secureHeaders）を
 * Remix のミドルウェアへ移植したもの。CSP の Web Analytics beacon 許可は現行と同じ。
 */
const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"img-src 'self' data:",
	"font-src 'self' data: https://fonts.gstatic.com",
	"connect-src 'self' https://cloudflareinsights.com",
].join("; ");

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
	["Content-Security-Policy", CONTENT_SECURITY_POLICY],
	["Referrer-Policy", "strict-origin-when-cross-origin"],
	["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"],
	["X-Content-Type-Options", "nosniff"],
	["X-Frame-Options", "DENY"],
	["Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=()"],
];

export function securityHeaders(): Middleware {
	return async (_context, next) => {
		const response = await next();
		const headers = new Headers(response.headers);

		for (const [name, value] of SECURITY_HEADERS) {
			if (!headers.has(name)) {
				headers.set(name, value);
			}
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}
