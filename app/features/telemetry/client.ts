import { sanitizeSentryBreadcrumb, sanitizeSentryEvent, sanitizeSentryLog } from "./sentry";

const dsn = import.meta.env.VITE_SENTRY_DSN;
type BrowserSentry = typeof import("@sentry/browser");

let sentryPromise: Promise<BrowserSentry | undefined> | undefined;
type ClientLogAttributes = Record<string, string | number | boolean>;

function loadSentry(): Promise<BrowserSentry | undefined> {
	if (!dsn) {
		return Promise.resolve(undefined);
	}

	sentryPromise ??= import("@sentry/browser")
		.then((Sentry) => {
			Sentry.init({
				dsn,
				release: __SENTRY_RELEASE__ || undefined,
				environment: import.meta.env.PROD ? "production" : "development",
				sendDefaultPii: false,
				enableLogs: true,
				beforeSend: sanitizeSentryEvent,
				beforeBreadcrumb: sanitizeSentryBreadcrumb,
				beforeSendLog: sanitizeSentryLog,
			});
			return Sentry;
		})
		.catch(() => undefined);

	return sentryPromise;
}

export function logClientEvent(
	level: "debug" | "info" | "warn" | "error",
	eventName: string,
	attributes: ClientLogAttributes = {},
): void {
	loadSentry()
		.then((Sentry) => {
			Sentry?.logger[level](eventName, {
				...attributes,
				schema_version: 1,
				service: "fit-redesign.browser",
				event_name: eventName,
			});
		})
		.catch(() => undefined);
}

export function initializeClientTelemetry(): void {
	loadSentry()
		.then((Sentry) => {
			Sentry?.logger.info("client.initialized", {
				schema_version: 1,
				service: "fit-redesign.browser",
				event_name: "client.initialized",
				outcome: "success",
			});
		})
		.catch(() => undefined);
}

export function reportClientError(error: unknown, action: string): void {
	loadSentry()
		.then((Sentry) => {
			if (!Sentry) {
				return;
			}

			Sentry.withScope((scope) => {
				scope.setTag("ui_action", action);
				Sentry.logger.error("client.exception", {
					schema_version: 1,
					service: "fit-redesign.browser",
					event_name: "client.exception",
					outcome: "failure",
					action,
					error_type: error instanceof Error ? error.name : "non_error",
				});
				Sentry.captureException(error);
			});
		})
		.catch(() => undefined);
}
