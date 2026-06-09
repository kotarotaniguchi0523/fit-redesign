import { z } from "zod";
import { type QuestionId, QuestionIdSchema } from "../../types";

export const TimerModeSchema = z.enum(["stopwatch", "countdown"], {
	error: "タイマーモードは 'stopwatch' または 'countdown' である必要があります",
});
export type TimerMode = z.infer<typeof TimerModeSchema>;

export const AttemptRecordSchema = z.object({
	timestamp: z
		.number({ error: "timestamp は数値である必要があります" })
		.int({ error: "timestamp は整数である必要があります" })
		.positive({ error: "timestamp は正の数である必要があります" }),
	duration: z
		.number({ error: "duration は数値である必要があります" })
		.int({ error: "duration は整数である必要があります" })
		.nonnegative({ error: "duration は0以上である必要があります" }),
	mode: TimerModeSchema,
	targetTime: z
		.number({ error: "targetTime は数値である必要があります" })
		.int({ error: "targetTime は整数である必要があります" })
		.positive({ error: "targetTime は正の数である必要があります" })
		.optional(),
	completed: z.boolean({ error: "completed は真偽値である必要があります" }),
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

export const QuestionTimeRecordSchema = z.object({
	questionId: QuestionIdSchema,
	attempts: z.array(AttemptRecordSchema, {
		error: "attempts は配列である必要があります",
	}),
});
export type QuestionTimeRecord = Omit<z.infer<typeof QuestionTimeRecordSchema>, "questionId"> & {
	questionId: QuestionId;
};

export const TimerStorageDataSchema = z.object({
	version: z.literal(1, { error: "version は 1 である必要があります" }),
	records: z
		.record(QuestionIdSchema, QuestionTimeRecordSchema, {
			error: "records はオブジェクトである必要があります",
		})
		.superRefine((records, ctx) => {
			const mismatchedRecords = Object.entries(records).filter(
				([key, record]) => key !== record.questionId,
			);
			for (const [key] of mismatchedRecords) {
				ctx.addIssue({
					code: "custom",
					path: [key, "questionId"],
					message: "records のキーと questionId は一致している必要があります",
				});
			}
		}),
});
export type TimerStorageData = Omit<z.infer<typeof TimerStorageDataSchema>, "records"> & {
	records: Partial<Record<QuestionId, QuestionTimeRecord>>;
};
