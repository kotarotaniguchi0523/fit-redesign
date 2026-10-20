import { z } from "zod";
import { ExamJsonSchema } from "../data/exams/schema";
import {
	ExamNumberSchema,
	PdfPathSchema,
	SlideIdSchema,
	UnitTabIdSchema,
	YearSchema,
} from "./domain";

export const SlideSchema = z
	.object({
		id: SlideIdSchema,
		title: z.string().min(1),
		pdfPath: PdfPathSchema,
	})
	.strict();

export const ExamByYearSchema = z
	.object({
		examNumber: ExamNumberSchema,
		title: z.string().min(1),
		availableYears: z.array(YearSchema),
		exams: z.partialRecord(YearSchema, ExamJsonSchema),
	})
	.strict();

export const UnitSchema = z
	.object({
		id: z.string().min(1),
		number: z.number().int().nonnegative(),
		name: z.string().min(1),
		slides: z.array(SlideSchema).min(1),
		exams: ExamByYearSchema.optional(),
		is2013Only: z.boolean().optional(),
	})
	.strict();

export const UnitExamMappingSchema = z
	.object({
		year: YearSchema,
		examNumbers: z.array(ExamNumberSchema).min(1),
		integratedTitle: z.string().min(1).optional(),
	})
	.strict();

export const UnitBasedTabSchema = z
	.object({
		id: UnitTabIdSchema,
		name: z.string().min(1),
		title: z.string().min(1),
		icon: z.string().min(1),
		description: z.string().min(1),
		slides: z.array(SlideSchema).min(1),
		examMapping: z.array(UnitExamMappingSchema).min(1),
	})
	.strict()
	.superRefine((tab, ctx) => {
		const years = tab.examMapping.map((mapping) => mapping.year);
		if (new Set(years).size !== years.length) {
			ctx.addIssue({
				code: "custom",
				path: ["examMapping"],
				message: "examMapping years must be unique within each unit tab",
			});
		}
	});

export const UnitBasedTabsSchema = z.array(UnitBasedTabSchema).superRefine((tabs, ctx) => {
	const ids = tabs.map((tab) => tab.id);
	if (new Set(ids).size !== ids.length) {
		ctx.addIssue({ code: "custom", path: [], message: "unit tab ids must be unique" });
	}
});

// 公開型は手書きせず、このファイルの検証スキーマからのみ導出する。
export type Slide = z.infer<typeof SlideSchema>;
export type ExamByYear = z.infer<typeof ExamByYearSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type UnitBasedTab = z.infer<typeof UnitBasedTabSchema>;
