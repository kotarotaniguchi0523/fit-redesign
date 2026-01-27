import { z } from "zod";

export const TimerModeSchema = z.enum(["stopwatch", "countdown"], {
	error: "タイマーモードは 'stopwatch' または 'countdown' である必要があります",
});
export type TimerMode = z.infer<typeof TimerModeSchema>;

export const AttemptRecordSchema = z.object({
	timestamp: z.number({ error: "timestamp は数値である必要があります" }),
	duration: z
		.number({ error: "duration は数値である必要があります" })
		.nonnegative({ error: "duration は0以上である必要があります" }),
	mode: TimerModeSchema,
	targetTime: z.number({ error: "targetTime は数値である必要があります" }).optional(),
	completed: z.boolean({ error: "completed は真偽値である必要があります" }),
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

export const QuestionTimeRecordSchema = z.object({
	questionId: z
		.string({ error: "questionId は文字列である必要があります" })
		.min(1, { error: "questionId は空にできません" }),
	attempts: z.array(AttemptRecordSchema, {
		error: "attempts は配列である必要があります",
	}),
});
export type QuestionTimeRecord = z.infer<typeof QuestionTimeRecordSchema>;

export const TimerStorageDataSchema = z.object({
	version: z.literal(1, { error: "version は 1 である必要があります" }),
	records: z.record(z.string(), QuestionTimeRecordSchema, {
		error: "records はオブジェクトである必要があります",
	}),
});
export type TimerStorageData = z.infer<typeof TimerStorageDataSchema>;

/** Zodエラーを読みやすい文字列にフォーマット */
export function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? `[${issue.path.join(".")}] ` : "";
			return `${path}${issue.message}`;
		})
		.join("; ");
}
