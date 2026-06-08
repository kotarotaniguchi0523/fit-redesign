import type { z } from "zod";

export function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? `[${issue.path.join(".")}] ` : "";
			return `${path}${issue.message}`;
		})
		.join("; ");
}

export function safeParseOrThrow<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
	const result = schema.safeParse(data);
	if (result.success) {
		return result.data;
	}
	throw new Error(`${context}: ${formatZodError(result.error)}`);
}
