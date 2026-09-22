import { z } from "zod";
import { ExamIdSchema, JudgmentSchema, QuestionIdSchema } from "../../types/domain";

const ChallengeIdSchema = z.string().uuid();
const TimestampSchema = z.number().int().positive();
const ElapsedMsSchema = z.number().int().nonnegative();

export const CompletedAnswerSchema = z
	.object({
		questionId: QuestionIdSchema,
		elapsedMs: ElapsedMsSchema,
		judgment: JudgmentSchema,
		createdAt: TimestampSchema,
		updatedAt: TimestampSchema,
	})
	.strict();

export const CompletedChallengeSchema = z
	.object({
		challengeId: ChallengeIdSchema,
		examId: ExamIdSchema,
		createdAt: TimestampSchema,
		updatedAt: TimestampSchema,
		answers: z.array(CompletedAnswerSchema).min(1).max(300),
	})
	.strict()
	.superRefine((challenge, ctx) => {
		if (challenge.createdAt > challenge.updatedAt) {
			ctx.addIssue({
				code: "custom",
				path: ["updatedAt"],
				message: "updatedAt must not precede createdAt",
			});
		}
		const questionIds = new Set<string>();
		for (const [index, answer] of challenge.answers.entries()) {
			if (questionIds.has(answer.questionId)) {
				ctx.addIssue({
					code: "custom",
					path: ["answers", index, "questionId"],
					message: "duplicate questionId",
				});
			}
			questionIds.add(answer.questionId);
			if (answer.createdAt > answer.updatedAt || answer.updatedAt !== challenge.updatedAt) {
				ctx.addIssue({
					code: "custom",
					path: ["answers", index],
					message: "invalid answer timestamps",
				});
			}
		}
	});

export const CompletedChallengesRequestSchema = z
	.object({ challenges: z.array(CompletedChallengeSchema).max(50) })
	.strict();
