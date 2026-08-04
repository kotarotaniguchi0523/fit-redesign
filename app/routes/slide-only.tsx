/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { PageHeading } from "../components/PageHeading";
import { SlideSection } from "../components/SlideSection";
import { slideOnlyUnits, unitBasedTabs } from "../data/units";
import type { Unit } from "../types";
import { YEARS } from "../types";

// 講義資料（単元タブ + 講義スライド一覧）。
const defaultYear = YEARS[0];

export default createRoute((c) =>
	c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container">
				<PageHeading
					eyebrow="資料"
					title="講義資料"
					description="講義スライドをPDFで確認できます。"
				/>
				<details class="study-navigator mb-4">
					<summary>
						<strong>問題ページを開く</strong>
						<span class="study-navigator__action">単元を選択</span>
					</summary>
					<div class="study-navigator__panel block">
						<div class="study-navigator__units">
							{unitBasedTabs.map((unit) => (
								<a href={`/${unit.id}/${unit.examMapping[0]?.year ?? defaultYear}`}>{unit.name}</a>
							))}
						</div>
					</div>
				</details>

				<div class="content-panel">
					{slideOnlyUnits.map((unit: Unit) => (
						<SlideSection title={unit.name} slides={unit.slides} />
					))}
				</div>
			</div>
		</main>,
		{ title: "講義資料 - 基本情報技術 I" },
	),
);
