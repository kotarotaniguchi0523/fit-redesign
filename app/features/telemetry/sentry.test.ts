import type { Breadcrumb, Event } from "@sentry/browser";
import { describe, expect, it } from "vitest";
import {
	getSentryConnectSources,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
	sanitizeSentryLog,
} from "./sentry";

describe("Sentry privacy filters", () => {
	it("keeps only the configured DSN origin for CSP", () => {
		expect(getSentryConnectSources("https://public-key@o123.ingest.us.sentry.io/456")).toEqual([
			"https://o123.ingest.us.sentry.io",
		]);
		expect(getSentryConnectSources(undefined)).toEqual([]);
		expect(getSentryConnectSources("not a DSN")).toEqual([]);
	});

	it("removes query, fragment, and request secrets from events", () => {
		const event: Event = {
			request: {
				url: "https://fit-redesign.example/records?sync=secret#sync=secret",
				query_string: "sync=secret",
				headers: { "x-sync-key": "secret" },
				cookies: { session: "secret" },
				data: { syncKey: "secret" },
				env: { SYNC_KEY: "secret" },
			},
			breadcrumbs: [
				{
					data: {
						url: "https://fit-redesign.example/progress?sync=secret#sync=secret",
						query_string: "sync=secret",
						headers: { "x-sync-key": "secret" },
						request_body: { syncKey: "secret" },
					},
				},
			],
		};

		const sanitized = sanitizeSentryEvent(event);

		expect(sanitized.request).toEqual({ url: "https://fit-redesign.example/records" });
		expect(sanitized.breadcrumbs?.[0]).toEqual({
			data: { url: "https://fit-redesign.example/progress" },
		});
		expect(event.request?.headers).toEqual({ "x-sync-key": "secret" });
	});

	it("sanitizes standalone breadcrumbs", () => {
		const breadcrumb: Breadcrumb = {
			data: {
				url: "https://fit-redesign.example/records?sync=secret#sync=secret",
				body: "secret",
				cookies: { session: "secret" },
			},
		};

		expect(sanitizeSentryBreadcrumb(breadcrumb)).toEqual({
			data: { url: "https://fit-redesign.example/records" },
		});
	});

	it("keeps structured log fields and removes sensitive attributes", () => {
		expect(
			sanitizeSentryLog({
				level: "info",
				message: "sync.operation?sync=secret",
				attributes: {
					action: "sync",
					request_url: "https://example.test/records?sync=secret",
					sync_key: "secret",
					headers: { authorization: "secret" },
					context: {
						request_url: "https://example.test/records#sync=secret",
						refresh_token: "secret",
						message: "Could not sync? Try again",
					},
				},
			}),
		).toEqual({
			level: "info",
			message: "sync.operation",
			attributes: {
				action: "sync",
				request_url: "https://example.test/records",
				context: {
					request_url: "https://example.test/records",
					message: "Could not sync? Try again",
				},
			},
		});
	});
});
