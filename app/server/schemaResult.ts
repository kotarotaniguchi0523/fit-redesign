import { err, ok, type Result } from "neverthrow";
import * as z from "zod/v4/core";

export type ValidationError = Readonly<{
	kind: "ValidationError";
	issues: z.$ZodIssue[];
}>;

export function schemaResult<Schema extends z.$ZodType>(
	schema: Schema,
): (raw: unknown) => Result<z.output<Schema>, ValidationError> {
	return (raw: unknown): Result<z.output<Schema>, ValidationError> => {
		const parsed = z.safeParse(schema, raw);
		return parsed.success
			? ok(parsed.data)
			: err({ kind: "ValidationError", issues: parsed.error.issues });
	};
}
