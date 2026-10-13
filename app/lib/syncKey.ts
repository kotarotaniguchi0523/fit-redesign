import { type SyncKey, SyncKeySchema } from "../types/index.ts";

const BASE64_PADDING_PATTERN = /=+$/;

/** 32 バイトの乱数から URL-safe Base64 の同期キーを作る（Web Crypto は Workers/Node 共通）。 */
export function generateSyncKey(): SyncKey {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	const encoded = btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(BASE64_PADDING_PATTERN, "");
	return SyncKeySchema.parse(encoded);
}
