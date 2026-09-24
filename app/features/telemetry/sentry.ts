import type { Breadcrumb, Event } from "@sentry/browser";

const URL_DETAILS_PATTERN = /[?#]/;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const URL_FIELD_PATTERN = /(?:^|[_-])(?:url|uri|href|link)(?:$|[_-])/i;
const SENSITIVE_FIELD_NAMES = new Set([
	"apikey",
	"authorization",
	"body",
	"cookie",
	"cookies",
	"data",
	"email",
	"env",
	"environment",
	"header",
	"headers",
	"ip",
	"ipaddress",
	"password",
	"passphrase",
	"phone",
	"privatekey",
	"query",
	"queryparams",
	"querystring",
	"secret",
	"synckey",
	"token",
	"user",
	"userid",
	"username",
]);
const REQUEST_FIELDS_TO_OMIT = new Set(["query_string", "headers", "cookies", "data", "env"]);
const BREADCRUMB_FIELDS_TO_OMIT = new Set([
	"body",
	"cookies",
	"headers",
	"query",
	"query_string",
	"request_body",
]);

function stripUrlDetails(url: string): string {
	const detailsStart = url.search(URL_DETAILS_PATTERN);
	return detailsStart === -1 ? url : url.slice(0, detailsStart);
}

function stripEmbeddedUrlDetails(value: string): string {
	return value.replace(URL_PATTERN, stripUrlDetails);
}

function isSensitiveField(field: string): boolean {
	const normalized = field.replace(/[^a-z\d]/gi, "").toLowerCase();
	return (
		SENSITIVE_FIELD_NAMES.has(normalized) ||
		[
			"apikey",
			"authorization",
			"cookie",
			"headers",
			"password",
			"passphrase",
			"privatekey",
			"secret",
			"synckey",
			"token",
		].some((suffix) => normalized.endsWith(suffix))
	);
}

function omitFields(value: object, fields: ReadonlySet<string>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([field]) => !fields.has(field)));
}

type SentryLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type SentryLog = {
	level: SentryLogLevel;
	message: string;
	attributes?: Record<string, unknown>;
};

function sanitizeLogAttributes(attributes: object): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(attributes).flatMap(([key, value]) => {
			if (isSensitiveField(key)) {
				return [];
			}

			if (typeof value === "string") {
				return [
					[
						key,
						URL_FIELD_PATTERN.test(key) ? stripUrlDetails(value) : stripEmbeddedUrlDetails(value),
					],
				];
			}

			if (Array.isArray(value)) {
				return [[key, value.map((item) => sanitizeLogValue(item))]];
			}

			if (value !== null && typeof value === "object") {
				return [[key, sanitizeLogAttributes(value)]];
			}

			return [[key, value]];
		}),
	);
}

function sanitizeLogValue(value: unknown): unknown {
	if (typeof value === "string") {
		return stripEmbeddedUrlDetails(value);
	}

	if (Array.isArray(value)) {
		return value.map(sanitizeLogValue);
	}

	if (value !== null && typeof value === "object") {
		return sanitizeLogAttributes(value);
	}

	return value;
}

export function sanitizeSentryLog(log: SentryLog): SentryLog {
	return {
		...log,
		message: stripUrlDetails(log.message),
		...(log.attributes ? { attributes: sanitizeLogAttributes(log.attributes) } : {}),
	};
}

export function getSentryConnectSources(...dsns: (string | undefined)[]): string[] {
	const sources = dsns.flatMap((dsn) => {
		if (!dsn) {
			return [];
		}

		try {
			const origin = new URL(dsn).origin;
			return origin === "null" ? [] : [origin];
		} catch {
			return [];
		}
	});
	return [...new Set(sources)];
}

export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
	if (!breadcrumb.data) {
		return breadcrumb;
	}

	const data = sanitizeLogAttributes(omitFields(breadcrumb.data, BREADCRUMB_FIELDS_TO_OMIT));
	const url = data.url;
	return {
		...breadcrumb,
		data: {
			...data,
			...(typeof url === "string" ? { url: stripUrlDetails(url) } : {}),
		},
	};
}

export function sanitizeSentryEvent<T extends Event>(event: T): T {
	const request =
		event.request && sanitizeLogAttributes(omitFields(event.request, REQUEST_FIELDS_TO_OMIT));
	const url = request?.url;
	return {
		...event,
		...(request
			? {
					request: {
						...request,
						...(typeof url === "string" ? { url: stripUrlDetails(url) } : {}),
					},
				}
			: {}),
		...(event.breadcrumbs ? { breadcrumbs: event.breadcrumbs.map(sanitizeSentryBreadcrumb) } : {}),
	};
}
