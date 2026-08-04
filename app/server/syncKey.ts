import { Result, type Result as ResultType } from "neverthrow";
import { SyncKeySchema, type SyncKey as SyncKeyType } from "../types/domain";
import { schemaResult, type ValidationError } from "./schemaResult";

const BASE64_PADDING_PATTERN = /=+$/;

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
	generate: (): ResultType<SyncKeyType, GenerateSyncKeyError> =>
		generateRandomKey().andThen(schemaResult(SyncKeySchema)),
} as const;
