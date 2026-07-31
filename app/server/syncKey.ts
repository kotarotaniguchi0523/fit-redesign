import { Result, type Result as ResultType } from "neverthrow";
import { z } from "zod";
import { schemaResult, type ValidationError } from "./schemaResult";

const BASE64_PADDING_PATTERN = /=+$/;
const SyncKeyBrand = Symbol("SyncKey");
const SyncKeySchema = z
	.string()
	.regex(/^[A-Za-z0-9_-]{43}$/, "同期キーの形式が正しくありません")
	.brand<typeof SyncKeyBrand>();

export type SyncKey = z.infer<typeof SyncKeySchema>;

export type GenerateSyncKeyError =
	| ValidationError
	| Readonly<{ kind: "GenerateSyncKeyError"; cause: unknown }>;

const generateRandomKey = Result.fromThrowable(
	(): string => {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
		return btoa(binary)
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replace(BASE64_PADDING_PATTERN, "");
	},
	(cause): GenerateSyncKeyError => ({ kind: "GenerateSyncKeyError", cause }),
);

export const SyncKey = {
	schema: SyncKeySchema,
	parse: schemaResult(SyncKeySchema),
	generate: (): ResultType<SyncKey, GenerateSyncKeyError> =>
		generateRandomKey().andThen(schemaResult(SyncKeySchema)),
} as const;
