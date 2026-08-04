import { z } from "zod";

export type {
	ProgressEntry,
	QuestionId,
	RevealedAt,
	SyncKey,
	UnitTabId,
} from "./browser";
export {
	ProgressEntryListSchema,
	ProgressEntrySchema,
	ProgressSnapshotSchema,
	ProgressSyncRequestSchema,
	QuestionIdSchema,
	RevealedAtSchema,
	SyncHeaderSchema,
	SyncKeySchema,
	UnitTabIdSchema,
} from "./browser";

export const YEARS = ["2013", "2014", "2015", "2016", "2017"] as const;
export const EXAM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const yearValues: ReadonlySet<string> = new Set(YEARS);
const examNumberValues: ReadonlySet<number> = new Set(EXAM_NUMBERS);

const examIdBrand: unique symbol = Symbol("ExamId");
const pdfPathBrand: unique symbol = Symbol("PdfPath");
const slideIdBrand: unique symbol = Symbol("SlideId");

export type Year = (typeof YEARS)[number];
export type ExamNumber = (typeof EXAM_NUMBERS)[number];

export const MEIJI_FIT_BASE = "https://www.isc.meiji.ac.jp/~kikn/FIT" as const;

export const YearSchema = z.enum(YEARS);
export const ExamNumberSchema = z
	.number()
	.int()
	.refine((value): value is ExamNumber => examNumberValues.has(value), {
		error: "exam number must be one of 1..9",
	});

export const ExamIdSchema = z
	.string({ error: "examId は文字列である必要があります" })
	.regex(/^exam[1-9]-(2013|2014|2015|2016|2017)$/, {
		error: "examId は exam{1-9}-{2013..2017} 形式である必要があります",
	})
	.brand<typeof examIdBrand>();

export const PdfPathSchema = z
	.string({ error: "pdfPath は文字列である必要があります" })
	.url({ error: "pdfPath は URL である必要があります" })
	.startsWith(`${MEIJI_FIT_BASE}/`, {
		error: "pdfPath は明治大学 FIT 公開ページ配下である必要があります",
	})
	.brand<typeof pdfPathBrand>();

export const SlideIdSchema = z
	.string({ error: "slideId は文字列である必要があります" })
	.regex(/^slide-(0|[1-9]\d*)$/, { error: "slideId は slide-{number} 形式である必要があります" })
	.brand<typeof slideIdBrand>();

export function isYear(value: string): value is Year {
	return yearValues.has(value);
}
