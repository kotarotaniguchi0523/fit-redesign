import { z } from "zod";

export const AnswerSubmitSchema = z.object({
	userId: z.string().min(1),
	questionId: z.string().regex(/^exam[1-9]-\d{4}-q\d+$/, {
		error: "questionId は exam{1-9}-{year}-q{n} 形式である必要があります",
	}),
	selectedLabel: z.string().min(1),
	isCorrect: z.boolean(),
	duration: z.number().nonnegative().optional(),
	timestamp: z.number(),
});
export type AnswerSubmit = z.infer<typeof AnswerSubmitSchema>;

export interface AnswerRecord {
	id: number;
	userId: string;
	questionId: string;
	selectedLabel: string;
	isCorrect: boolean;
	duration: number | null;
	timestamp: number;
	createdAt: number;
}

export interface AnswerStatus {
	label: string;
	isCorrect: boolean;
}
