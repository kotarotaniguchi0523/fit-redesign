import type { JSX } from "hono/jsx/jsx-runtime";
import type { Slide } from "../types";

interface SlideSectionProps {
	slides: Slide[];
}

export function SlideSection({ slides }: SlideSectionProps): JSX.Element {
	return (
		<div class="mb-4 rounded-xl border border-blue-100 bg-linear-to-br from-blue-50/50 to-indigo-50/30">
			<div class="p-5">
				<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-[#1e3a5f]">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-black">
						PDF
					</span>
					講義スライド
				</h3>
				<div class="space-y-2">
					{slides.map((slide) => (
						<div class="flex flex-col gap-2 rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
							<span class="text-sm text-gray-700 wrap-break-words">{slide.title}</span>
							<a
								href={slide.pdfPath}
								target="_blank"
								rel="noopener noreferrer"
								class="w-full rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#2d4a6f] sm:w-auto"
							>
								開く ↗
							</a>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
