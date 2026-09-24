import { logger } from "@sentry/cloudflare";

type ServerLogAttributes = Record<string, string | number | boolean>;

export function logServerEvent(
	level: "debug" | "info" | "warn" | "error",
	eventName: string,
	attributes: ServerLogAttributes = {},
): void {
	logger[level](eventName, {
		...attributes,
		schema_version: 1,
		service: "fit-redesign.worker",
		event_name: eventName,
	});
}
