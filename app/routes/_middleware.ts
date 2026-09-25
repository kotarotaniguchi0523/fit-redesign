import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { createRoute } from "honox/factory";

const structuredRequestLogger = createMiddleware(async (c, next) => {
	const startedAt = performance.now();
	await next();
	// biome-ignore lint/suspicious/noConsole: JSON request logging is an intentional server boundary effect.
	console.log(
		JSON.stringify({
			timestamp: new Date().toISOString(),
			requestId: c.res.headers.get("X-Request-Id"),
			method: c.req.method,
			path: c.req.path,
			status: c.res.status,
			durationMs: Math.round(performance.now() - startedAt),
		}),
	);
});

// app/routes/ 直下に置いているため全ルート（ページ + API エンドポイント）に適用される
// （HonoX が subApp.use("*", ...) する）。JSONログにはクエリを含めず、request-idも記録する。
export default createRoute(every(requestId(), structuredRequestLogger, timing()));
