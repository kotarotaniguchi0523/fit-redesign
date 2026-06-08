/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import { SlideSection } from "../components/SlideSection";
import { slideOnlyUnits, unitBasedTabs } from "../data/units";
import type { Unit } from "../types";
import { YEARS } from "../types";

// 講義資料のみ（単元タブ + 講義スライド一覧）。
const defaultYear = YEARS[0];

export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="container mx-auto px-4 py-6 max-w-5xl">
				<div class="w-full">
					{/* 単元タブ */}
					<div class="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="単元選択">
						{unitBasedTabs.map((unit) => (
							<a
								href={`/${unit.id}/${defaultYear}`}
								class="px-4 py-2 rounded-lg border text-sm font-medium transition-all h-auto min-h-[40px] whitespace-normal text-center bg-white text-gray-700 border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
							>
								{unit.name}
							</a>
						))}
						<span class="px-4 py-2 rounded-lg border text-sm font-medium h-auto min-h-[40px] whitespace-normal text-center bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm">
							講義資料のみ
						</span>
					</div>

					{/* 講義資料 */}
					<div class="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
						{slideOnlyUnits.map((unit: Unit) => (
							<SlideSection slides={unit.slides} />
						))}
					</div>
				</div>
			</main>
		</>,
		{ title: "講義資料のみ - 基本情報技術 I" },
	),
);
