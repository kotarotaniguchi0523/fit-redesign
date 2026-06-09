import { z } from "zod";

export const YEARS = ["2013", "2014", "2015", "2016", "2017"] as const;
export const EXAM_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

declare const userIdBrand: unique symbol;
declare const examIdBrand: unique symbol;
declare const questionIdBrand: unique symbol;
declare const pdfPathBrand: unique symbol;
declare const slideIdBrand: unique symbol;
declare const unitTabIdBrand: unique symbol;

export type Year = (typeof YEARS)[number];
export type ExamNumber = (typeof EXAM_NUMBERS)[number];

export const MEIJI_FIT_BASE = "https://www.isc.meiji.ac.jp/~kikn/FIT" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const YearSchema = z.enum(YEARS);
export const ExamNumberSchema = z
	.number()
	.int()
	.refine((value): value is ExamNumber => EXAM_NUMBERS.includes(value as ExamNumber), {
		error: "exam number must be one of 1..9",
	});

export const UserIdSchema = z
	.string({ error: "userId は文字列である必要があります" })
	.regex(UUID_RE, { error: "userId は UUID 形式である必要があります" })
	.transform((value) => value.toLowerCase())
	.brand<typeof userIdBrand>();

export const ExamIdSchema = z
	.string({ error: "examId は文字列である必要があります" })
	.regex(/^exam[1-9]-(2013|2014|2015|2016|2017)$/, {
		error: "examId は exam{1-9}-{2013..2017} 形式である必要があります",
	})
	.brand<typeof examIdBrand>();

export const QuestionIdSchema = z
	.string({ error: "questionId は文字列である必要があります" })
	.regex(/^exam[1-9]-(2013|2014|2015|2016|2017)-q[1-9]\d*$/, {
		error: "questionId は exam{1-9}-{2013..2017}-q{positive} 形式である必要があります",
	})
	.brand<typeof questionIdBrand>();

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

export const UnitTabIdSchema = z
	.string({ error: "unit id は文字列である必要があります" })
	.regex(/^unit-[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		error: "unit id は unit-{kebab-case} 形式である必要があります",
	})
	.brand<typeof unitTabIdBrand>();

export type UserId = z.infer<typeof UserIdSchema>;
export type ExamId = z.infer<typeof ExamIdSchema>;
export type QuestionId = z.infer<typeof QuestionIdSchema>;
export type PdfPath = z.infer<typeof PdfPathSchema>;
export type SlideId = z.infer<typeof SlideIdSchema>;
export type UnitTabId = z.infer<typeof UnitTabIdSchema>;

export function isYear(value: string): value is Year {
	return YEARS.includes(value as Year);
}

export function isExamNumber(value: number): value is ExamNumber {
	return EXAM_NUMBERS.includes(value as ExamNumber);
}
