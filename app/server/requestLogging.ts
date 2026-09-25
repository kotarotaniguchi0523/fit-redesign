import { structuredLogger } from "@hono/structured-logger";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

type RequestLogEntry = Readonly<{
	timestamp: string;
	requestId: string | null;
	method: string;
	path: string;
	status: number;
	durationMs: number;
	error?: string;
}>;

function requestLogEntry(c: Context, elapsedMs: number, error?: Error): RequestLogEntry {
	return {
		timestamp: new Date().toISOString(),
		requestId: c.res.headers.get("X-Request-Id"),
		method: c.req.method,
		path: c.req.path,
		status: c.res.status,
		durationMs: Math.round(elapsedMs),
		...(error ? { error: error.name } : {}),
	};
}

// Keep the log side effect at the server boundary; paths exclude query strings and secrets.
export const requestLoggingMiddleware = [
	structuredLogger({
		createLogger: () => console,
		onResponse: (logger, c, elapsedMs) =>
			logger.info(JSON.stringify(requestLogEntry(c, elapsedMs))),
		onError: (logger, error, c, elapsedMs) =>
			logger.error(JSON.stringify(requestLogEntry(c, elapsedMs, error))),
	}),
	requestId(),
] as const;
