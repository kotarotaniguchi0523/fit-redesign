import { err, ok, ResultAsync } from "neverthrow";
import { isProgressEntry, mergeProgressEntries, type ProgressEntry } from "./progress";

function assertNever(value: never): never {
	throw new Error(`Unexpected sync error: ${String(value)}`);
}

export type SyncProgressError =
	| Readonly<{ kind: "InvalidSyncLink" }>
	| Readonly<{ kind: "RequestFailed"; cause: unknown }>
	| Readonly<{ kind: "InvalidResponse"; cause?: unknown }>;

function parseSyncEntries(value: unknown): readonly ProgressEntry[] | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const entries = (value as Record<string, unknown>).entries;
	return Array.isArray(entries) && entries.every(isProgressEntry) ? entries : null;
}

export function syncProgress(
	key: string,
	local: readonly ProgressEntry[],
): ResultAsync<ProgressEntry[], SyncProgressError> {
	return ResultAsync.fromPromise(
		fetch("/progress/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Sync-Key": key },
			body: JSON.stringify({ entries: local }),
		}),
		(cause): SyncProgressError => ({ kind: "RequestFailed", cause }),
	).andThen((response) => {
		if (!response.ok) {
			return err<never, SyncProgressError>(
				response.status === 404
					? { kind: "InvalidSyncLink" }
					: { kind: "RequestFailed", cause: response },
			);
		}
		return ResultAsync.fromPromise(
			response.json(),
			(cause): SyncProgressError => ({ kind: "InvalidResponse", cause }),
		).andThen((body) => {
			const remote = parseSyncEntries(body);
			return remote
				? ok(mergeProgressEntries(local, remote))
				: err<never, SyncProgressError>({ kind: "InvalidResponse" });
		});
	});
}

export function syncProgressErrorMessage(error: SyncProgressError): string {
	switch (error.kind) {
		case "InvalidSyncLink":
			return "同期リンクが無効です";
		case "InvalidResponse":
			return "同期結果の形式が正しくありません";
		case "RequestFailed":
			return "同期できませんでした";
		default:
			return assertNever(error);
	}
}
