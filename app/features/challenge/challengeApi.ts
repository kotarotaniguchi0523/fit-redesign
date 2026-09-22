import { hc } from "hono/client";
import { err, okAsync, ResultAsync } from "neverthrow";
import type { ProgressApp } from "../../routes/progress";
import type { SyncKey } from "../../types";
import { isCompletedChallengePayload, mergeCompletedChallenges } from "./challenge";
import type { CompletedChallengePayload } from "./types";

export type ChallengeSyncError =
	| Readonly<{ kind: "InvalidSyncLink" }>
	| Readonly<{ kind: "Conflict" }>
	| Readonly<{ kind: "RequestFailed"; cause: unknown }>
	| Readonly<{ kind: "InvalidResponse"; cause?: unknown }>;

const progressClient = hc<ProgressApp>("/progress");

function parseResponse(body: unknown): readonly CompletedChallengePayload[] | null {
	if (
		!body ||
		typeof body !== "object" ||
		!("challenges" in body) ||
		!Array.isArray(body.challenges)
	) {
		return null;
	}
	return body.challenges.every(isCompletedChallengePayload) ? [...body.challenges] : null;
}

export function syncChallenges(
	key: SyncKey,
	local: readonly CompletedChallengePayload[],
): ResultAsync<CompletedChallengePayload[], ChallengeSyncError> {
	return ResultAsync.fromPromise(
		progressClient.challenges.$post({
			json: {
				challenges: local.map((challenge) => ({
					...challenge,
					answers: challenge.answers.map((answer) => ({ ...answer })),
				})),
			},
			header: { "x-sync-key": key },
		}),
		(cause): ChallengeSyncError => ({ kind: "RequestFailed", cause }),
	).andThen((response) => {
		if (!response.ok) {
			if (response.status === 404) {
				return err<never, ChallengeSyncError>({ kind: "InvalidSyncLink" });
			}
			if (response.status === 409) {
				return err<never, ChallengeSyncError>({ kind: "Conflict" });
			}
			return err<never, ChallengeSyncError>({ kind: "RequestFailed", cause: response });
		}
		return ResultAsync.fromPromise(
			response.json(),
			(cause): ChallengeSyncError => ({ kind: "InvalidResponse", cause }),
		).andThen((body) => {
			const parsed = parseResponse(body);
			return parsed
				? okAsync([...mergeCompletedChallenges(local, parsed)])
				: err<CompletedChallengePayload[], ChallengeSyncError>({ kind: "InvalidResponse" });
		});
	});
}

export function challengeSyncErrorMessage(error: ChallengeSyncError): string {
	switch (error.kind) {
		case "InvalidSyncLink":
			return "同期リンクが無効です";
		case "Conflict":
			return "同じ試行IDに別の結果があるため同期できませんでした";
		case "InvalidResponse":
			return "同期結果の形式が正しくありません";
		case "RequestFailed":
			return "小テスト結果を同期できませんでした";
		default:
			error satisfies never;
			return "同期できませんでした";
	}
}
