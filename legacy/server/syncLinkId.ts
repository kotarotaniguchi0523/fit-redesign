import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { SyncKey } from "../types/domain";
import { schemaResult } from "./schemaResult";

const SyncLinkIdBrand: unique symbol = Symbol("SyncLinkId");
const SyncLinkIdSchema = z.string().length(64).brand<typeof SyncLinkIdBrand>();

export type SyncLinkId = z.infer<typeof SyncLinkIdSchema>;

export type HashSyncKeyError = Readonly<{
	kind: "HashSyncKeyError";
	cause: unknown;
}>;

export const SyncLinkId = {
	schema: SyncLinkIdSchema,
	parse: schemaResult(SyncLinkIdSchema),
	fromSyncKey: (syncKey: SyncKey): ResultAsync<SyncLinkId, HashSyncKeyError> =>
		ResultAsync.fromPromise(
			crypto.subtle.digest("SHA-256", new TextEncoder().encode(syncKey)),
			(cause): HashSyncKeyError => ({ kind: "HashSyncKeyError", cause }),
		).andThen((digest) => {
			const parsed = SyncLinkId.parse(
				Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
			);
			return parsed.isOk()
				? okAsync(parsed.value)
				: errAsync<SyncLinkId, HashSyncKeyError>({
						kind: "HashSyncKeyError",
						cause: parsed.error,
					});
		}),
} as const;
