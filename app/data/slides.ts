import { deepFreeze } from "../lib/immutable";
import { safeParseOrThrow } from "../lib/zod";
import { type Slide, SlideIdSchema, SlideSchema } from "../types";

const SlidesSchema = SlideSchema.array();

const slidesData = [
	{
		id: "slide-0",
		title: "ガイダンス",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT0-guidance2013.pdf",
	},
	{
		id: "slide-1",
		title: "基数変換",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT1-Base.pdf",
	},
	{
		id: "slide-2",
		title: "符号・算術演算",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT2-Signedb.pdf",
	},
	{
		id: "slide-3",
		title: "集合と論理",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT3-logic.pdf",
	},
	{
		id: "slide-4",
		title: "確率と統計",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT4-prob.pdf",
	},
	{
		id: "slide-5",
		title: "オートマトン",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT5-state.pdf",
	},
	{
		id: "slide-6",
		title: "符号理論",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT6-ECC.pdf",
	},
	{
		id: "slide-7",
		title: "制御理論",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT7-FB.pdf",
	},
	{
		id: "slide-8",
		title: "データ構造",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT8-Stack.pdf",
	},
	{
		id: "slide-9",
		title: "2分検索木",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT9-Tree.pdf",
	},
	{
		id: "slide-10",
		title: "ソート",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT10-Sort.pdf",
	},
	{
		id: "slide-11",
		title: "計算量",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT11-Orderb.pdf",
	},
	{
		id: "slide-12",
		title: "プログラミング言語",
		pdfPath: "https://www.isc.meiji.ac.jp/~kikn/FIT/FIT12-Progb.pdf",
	},
];

const parsedSlides = safeParseOrThrow(SlidesSchema, slidesData, "Invalid slides");
deepFreeze(parsedSlides);
export const slides = parsedSlides;

const slidesById = new Map(slides.map((slide) => [slide.id, slide] as const));

export function getSlide(id: string): Slide {
	const parsedId = SlideIdSchema.safeParse(id);
	if (!parsedId.success) {
		throw new Error(`Invalid slide id format: ${id}`);
	}
	const slide = slidesById.get(parsedId.data);
	if (!slide) {
		throw new Error(`Unknown slide id: ${id}`);
	}
	return slide;
}
