import { z } from "zod";

import type { SyncKey } from "../types/index.ts";

const SyncLinkIdBrand: unique symbol = Symbol("SyncLinkId");

/** 同期キーの SHA-256（hex 64桁）。同期キー本体は保存しない。 */
export const SyncLinkIdSchema = z
	.string()
	.regex(/^[0-9a-f]{64}$/)
	.brand<typeof SyncLinkIdBrand>();

export type SyncLinkId = z.infer<typeof SyncLinkIdSchema>;

export async function syncLinkIdFromSyncKey(syncKey: SyncKey): Promise<SyncLinkId> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(syncKey));
	const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
	return SyncLinkIdSchema.parse(hex);
}
