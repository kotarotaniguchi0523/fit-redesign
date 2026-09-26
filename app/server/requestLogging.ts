import { structuredLogger } from "@hono/structured-logger";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

type RequestLogEntry = Readonly<{
	event: "app.route.response" | "app.route.error";
	route: string;
	method: string;
	status: number;
	error?: string;
}>;

function requestLogEntry(c: Context, error?: Error): RequestLogEntry {
	return {
		event: error ? "app.route.error" : "app.route.response",
		route: c.req.routePath || "unmatched",
		method: c.req.method,
		status: c.res.status,
		...(error ? { error: error.name } : {}),
	};
}

// Cloudflare invocation logs already carry request timing and status; this adds only Hono's matched route.
export const requestLoggingMiddleware = [
	structuredLogger({
		createLogger: () => console,
		onResponse: (logger, c) => logger.info(JSON.stringify(requestLogEntry(c))),
		onError: (logger, error, c) => logger.error(JSON.stringify(requestLogEntry(c, error))),
	}),
	requestId(),
] as const;
