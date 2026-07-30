import type { Result } from "neverthrow";
import { z } from "zod";
import { schemaResult, type ValidationError } from "./schemaResult";

const BASE64_PADDING_PATTERN = /=+$/;
const SyncKeyBrand = Symbol("SyncKey");
const SyncKeySchema = z
	.string()
	.regex(/^[A-Za-z0-9_-]{43}$/, "同期キーの形式が正しくありません")
	.brand<typeof SyncKeyBrand>();

export type SyncKey = z.infer<typeof SyncKeySchema>;

export const SyncKey = {
	schema: SyncKeySchema,
	parse: schemaResult(SyncKeySchema),
	generate: (): Result<SyncKey, ValidationError> => {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
		return schemaResult(SyncKeySchema)(
			btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(BASE64_PADDING_PATTERN, ""),
		);
	},
} as const;
