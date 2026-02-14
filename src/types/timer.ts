import { z } from "zod";
import { formatZodError as formatSharedZodError } from "../utils/zod";
import type { QuestionId } from "./index";

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

const QuestionIdSchema = z
	.string({ error: "questionId は文字列である必要があります" })
	.regex(/^exam[1-9]-\d{4}-q\d+$/, {
		error: "questionId は exam{1-9}-{year}-q{n} 形式である必要があります",
	});

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
			for (const [key, record] of Object.entries(records)) {
				if (key !== record.questionId) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: [key, "questionId"],
						message: "records のキーと questionId は一致している必要があります",
					});
				}
			}
		}),
});
export type TimerStorageData = Omit<z.infer<typeof TimerStorageDataSchema>, "records"> & {
	records: Partial<Record<QuestionId, QuestionTimeRecord>>;
};

/** Zodエラーを読みやすい文字列にフォーマット */
export function formatZodError(error: z.ZodError): string {
	return formatSharedZodError(error);
}
