import { err, ok, type Result } from "neverthrow";
import type { z } from "zod";

export type ValidationError = Readonly<{
	kind: "ValidationError";
	issues: z.core.$ZodIssue[];
}>;

export function schemaResult<Schema extends z.ZodType>(
	schema: Schema,
): (raw: unknown) => Result<z.output<Schema>, ValidationError> {
	return (raw: unknown): Result<z.output<Schema>, ValidationError> => {
		const parsed = schema.safeParse(raw);
		return parsed.success
			? ok(parsed.data)
			: err({ kind: "ValidationError", issues: parsed.error.issues });
	};
}
