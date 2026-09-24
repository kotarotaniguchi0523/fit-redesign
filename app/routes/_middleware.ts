import { every } from "hono/combine";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { createRoute } from "honox/factory";
import { logServerEvent } from "../features/telemetry/server";

function getRequestLogLevel(statusCode: number): "error" | "info" | "warn" {
	if (statusCode >= 500) {
		return "error";
	}

	if (statusCode >= 400) {
		return "warn";
	}

	return "info";
}

// app/routes/ 直下に置いているため全ルート（ページ + API エンドポイント）に適用される。
// Cloudflare Logs向けの既存ログに加え、Sentryへ秘匿情報を含まない構造化アクセスログを送る。
export default createRoute(
	every(logger(), requestId(), timing(), async (c, next) => {
		const startedAt = performance.now();
		let errorType: string | undefined;
		try {
			await next();
		} catch (error: unknown) {
			errorType = error instanceof Error ? error.name : "non_error";
			logServerEvent("error", "http.exception", {
				outcome: "failure",
				method: c.req.method,
				route: c.req.routePath || "<unmatched>",
				request_id: c.get("requestId"),
				error_type: errorType,
			});
			throw error;
		} finally {
			const statusCode = errorType ? 500 : c.res.status;
			const outcome = statusCode >= 400 ? "failure" : "success";
			logServerEvent(getRequestLogLevel(statusCode), "http.request", {
				outcome,
				method: c.req.method,
				route: c.req.routePath || "<unmatched>",
				request_id: c.get("requestId"),
				status_code: statusCode,
				duration_ms: Math.round(performance.now() - startedAt),
			});
		}
	}),
);
