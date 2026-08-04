import type { JSX } from "hono/jsx/jsx-runtime";
import { type QuestionLocation, useContinueLearning } from "./useContinueLearning";

export default function ContinueLearning({
	locations,
}: {
	locations: readonly QuestionLocation[];
}): JSX.Element | null {
	const location = useContinueLearning(locations);
	if (!location) {
		return null;
	}

	return (
		<aside class="mt-8 rounded-2xl border border-[#c9a227]/40 bg-[#fffaf0] p-4 sm:p-5">
			<p class="text-sm font-bold text-[#6f5712]">前回の続き</p>
			<div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p class="font-bold text-[#1e3a5f]">
					{location.unitName}・{location.year}年度
				</p>
				<a
					class="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white"
					href={location.href}
				>
					続きから見る
				</a>
			</div>
		</aside>
	);
}
