/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { PageHeading } from "../components/PageHeading";
import { unitBasedTabs } from "../data/units";
import RecordsView from "../features/progress/$RecordsView";

const unitNames = Object.fromEntries(unitBasedTabs.map((unit) => [unit.id, unit.name]));

export default createRoute((c) =>
	c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container">
				<PageHeading
					eyebrow="任意機能"
					title="学習記録"
					description="答えを確認した問題を、この端末に記録します。"
				/>
				<RecordsView unitNames={unitNames} />
			</div>
		</main>,
		{
			title: "学習記録 - 基本情報技術 I",
			description: "答えを確認した問題の履歴を端末内で確認できます。",
			noindex: true,
		},
	),
);
