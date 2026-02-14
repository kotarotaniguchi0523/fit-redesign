import { z } from "zod";
import type { Slide, SlideId } from "../types/index";

export const slides: Slide[] = [
	{ id: "slide-0", title: "ガイダンス", pdfPath: "/pdf/FIT0-guidance2013.pdf" },
	{ id: "slide-1", title: "基数変換", pdfPath: "/pdf/FIT1-Base.pdf" },
	{ id: "slide-2", title: "符号・算術演算", pdfPath: "/pdf/FIT2-Signedb.pdf" },
	{ id: "slide-3", title: "集合と論理", pdfPath: "/pdf/FIT3-logic.pdf" },
	{ id: "slide-4", title: "確率と統計", pdfPath: "/pdf/FIT4-prob.pdf" },
	{ id: "slide-5", title: "オートマトン", pdfPath: "/pdf/FIT5-state.pdf" },
	{ id: "slide-6", title: "符号理論", pdfPath: "/pdf/FIT6-ECC.pdf" },
	{ id: "slide-7", title: "制御理論", pdfPath: "/pdf/FIT7-FB.pdf" },
	{ id: "slide-8", title: "データ構造", pdfPath: "/pdf/FIT8-Stack.pdf" },
	{ id: "slide-9", title: "2分検索木", pdfPath: "/pdf/FIT9-Tree.pdf" },
	{ id: "slide-10", title: "ソート", pdfPath: "/pdf/FIT10-Sort.pdf" },
	{ id: "slide-11", title: "計算量", pdfPath: "/pdf/FIT11-Orderb.pdf" },
	{ id: "slide-12", title: "プログラミング言語", pdfPath: "/pdf/FIT12-Progb.pdf" },
];

const SlideIdSchema = z.custom<SlideId>(
	(value) => typeof value === "string" && /^slide-\d+$/.test(value),
	{
		error: "slide id must match slide-{number}",
	},
);

const slidesById: Record<SlideId, Slide> = Object.fromEntries(
	slides.map((slide) => [slide.id, slide] as const),
) as Record<SlideId, Slide>;

export function getSlide(id: Slide["id"]): Slide {
	const parsedId = SlideIdSchema.safeParse(id);
	if (!parsedId.success) {
		throw new Error(`Invalid slide id format: ${id}`);
	}
	const slide = slidesById[parsedId.data];
	if (!slide) {
		throw new Error(`Unknown slide id: ${id}`);
	}
	return slide;
}
