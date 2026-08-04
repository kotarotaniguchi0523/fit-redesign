import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { SyncKey } from "../types/domain";
import { schemaResult } from "./schemaResult";

const SyncSpaceIdBrand: unique symbol = Symbol("SyncSpaceId");
const SyncSpaceIdSchema = z.string().length(64).brand<typeof SyncSpaceIdBrand>();

export type SyncSpaceId = z.infer<typeof SyncSpaceIdSchema>;

export type HashSyncKeyError = Readonly<{
	kind: "HashSyncKeyError";
	cause: unknown;
}>;

export const SyncSpaceId = {
	schema: SyncSpaceIdSchema,
	parse: schemaResult(SyncSpaceIdSchema),
	fromSyncKey: (syncKey: SyncKey): ResultAsync<SyncSpaceId, HashSyncKeyError> =>
		ResultAsync.fromPromise(
			crypto.subtle.digest("SHA-256", new TextEncoder().encode(syncKey)),
			(cause): HashSyncKeyError => ({ kind: "HashSyncKeyError", cause }),
		).andThen((digest) => {
			const parsed = SyncSpaceId.parse(
				Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
			);
			return parsed.isOk()
				? okAsync(parsed.value)
				: errAsync<SyncSpaceId, HashSyncKeyError>({
						kind: "HashSyncKeyError",
						cause: parsed.error,
					});
		}),
} as const;
