import { z } from "zod";
import { QuestionIdSchema, UnitTabIdSchema } from "../types";
import { schemaResult } from "./schemaResult";

const ProgressEntrySchema = z
	.object({
		questionId: QuestionIdSchema,
		unitId: UnitTabIdSchema,
		revealedAt: z.number().int().positive(),
	})
	.strict()
	.readonly();

const ProgressEntryListSchema = z.array(ProgressEntrySchema).readonly();

export type ProgressEntry = z.infer<typeof ProgressEntrySchema>;

export const ProgressEntry = {
	schema: ProgressEntrySchema,
	listSchema: ProgressEntryListSchema,
	parse: schemaResult(ProgressEntrySchema),
	parseList: schemaResult(ProgressEntryListSchema),
} as const;
