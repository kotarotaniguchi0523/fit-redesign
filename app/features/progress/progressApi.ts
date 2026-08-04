import { hc } from "hono/client";
import { err, ResultAsync } from "neverthrow";
import type { ProgressApp } from "../../routes/progress";
import type { SyncKey } from "../../types";
import { mergeProgressEntries, type ProgressEntry } from "./progress";

function assertNever(value: never): never {
	throw new Error(`Unexpected sync error: ${String(value)}`);
}

export type SyncProgressError =
	| Readonly<{ kind: "InvalidSyncLink" }>
	| Readonly<{ kind: "RequestFailed"; cause: unknown }>
	| Readonly<{ kind: "InvalidResponse"; cause?: unknown }>;

const progressClient = hc<ProgressApp>("/progress");

export function createSyncSpace(): ReturnType<typeof progressClient.spaces.$post> {
	return progressClient.spaces.$post();
}

export function deleteRemoteProgress(
	key: SyncKey,
): ReturnType<typeof progressClient.index.$delete> {
	return progressClient.index.$delete({ header: { "x-sync-key": key } });
}

export function syncProgress(
	key: SyncKey,
	local: readonly ProgressEntry[],
): ResultAsync<ProgressEntry[], SyncProgressError> {
	return ResultAsync.fromPromise(
		progressClient.sync.$post({ json: { entries: local }, header: { "x-sync-key": key } }),
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
		).map((body) => mergeProgressEntries(local, body.entries));
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
