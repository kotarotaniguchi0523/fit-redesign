import { Result, type Result as ResultType } from "neverthrow";
import { SyncKeySchema, type SyncKey as SyncKeyType } from "../types/domain";
import { schemaResult, type ValidationError } from "./schemaResult";

const BASE64_PADDING_PATTERN = /=+$/;

export type GenerateSyncKeyError =
	| ValidationError
	| Readonly<{ kind: "GenerateSyncKeyError"; cause: unknown }>;

export type RandomBytes = (length: number) => ResultType<Uint8Array, GenerateSyncKeyError>;

export const secureRandomBytes: RandomBytes = Result.fromThrowable(
	(length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length)),
	(cause): GenerateSyncKeyError => ({ kind: "GenerateSyncKeyError", cause }),
);

function encodeRandomBytes(bytes: Uint8Array): string {
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(BASE64_PADDING_PATTERN, "");
}

export const SyncKey = {
	schema: SyncKeySchema,
	parse: schemaResult(SyncKeySchema),
	fromRandomBytes: (bytes: Uint8Array): ResultType<SyncKeyType, GenerateSyncKeyError> =>
		schemaResult(SyncKeySchema)(encodeRandomBytes(bytes)),
	generate: (randomBytes: RandomBytes): ResultType<SyncKeyType, GenerateSyncKeyError> =>
		randomBytes(32).andThen(SyncKey.fromRandomBytes),
} as const;
