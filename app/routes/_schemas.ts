import { z } from "zod";
import { QuestionIdSchema } from "../types";

export const AnswerSubmitSchema = z
	.object({
		questionId: QuestionIdSchema,
		selectedLabel: z.string().min(1).max(32),
		isCorrect: z.boolean(),
		duration: z.number().int().nonnegative().optional(),
		timestamp: z.number().int().positive(),
	})
	.strict();

// /timer/sync・/timer/clear の API リクエストスキーマ（ワイヤ形式）。
// クライアント localStorage の生データを受けるため sync の questionId は緩い文字列で受ける。
const SyncAttemptSchema = z
	.object({
		timestamp: z.number().int().positive(),
		duration: z.number().int().nonnegative(),
		mode: z.enum(["stopwatch", "countdown"]),
		completed: z.boolean(),
		targetTime: z.number().int().positive().optional(),
	})
	.strict();

const SyncRecordSchema = z
	.object({
		questionId: QuestionIdSchema,
		attempts: z.array(SyncAttemptSchema).max(50),
	})
	.strict();

export const SyncRequestSchema = z
	.object({
		records: z.record(QuestionIdSchema, SyncRecordSchema),
	})
	.strict()
	.superRefine((request, ctx) => {
		for (const [key, record] of Object.entries(request.records)) {
			if (key !== record.questionId) {
				ctx.addIssue({
					code: "custom",
					path: ["records", key, "questionId"],
					message: "records のキーと questionId は一致している必要があります",
				});
			}
		}
	});

export const ClearQuerySchema = z
	.object({
		questionId: QuestionIdSchema,
	})
	.strict();
