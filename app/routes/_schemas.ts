import { z } from "zod";
import { QuestionIdSchema } from "../types";

export const AnswerSubmitSchema = z
	.object({
		questionId: QuestionIdSchema,
		selectedLabel: z.string().min(1).max(32),
		isCorrect: z.boolean(),
		duration: z.number().int().nonnegative().optional(),
	})
	.strict();
