/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import { unitBasedTabs } from "../data/units";
import RecordsView from "../features/progress/$RecordsView";

const unitNames = Object.fromEntries(unitBasedTabs.map((unit) => [unit.id, unit.name]));

export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="mx-auto max-w-4xl px-4 py-8">
				<div class="mb-6">
					<p class="text-sm font-bold tracking-wider text-[#9a7a19]">OPTION</p>
					<h1 class="mt-1 text-2xl font-bold text-[#1e3a5f]" style="font-family: var(--font-serif)">
						学習記録
					</h1>
					<p class="mt-2 text-gray-600">答えを確認した問題を、この端末にだけ記録します。</p>
				</div>
				<RecordsView unitNames={unitNames} />
			</main>
		</>,
		{
			title: "学習記録 - 基本情報技術 I",
			description: "答えを確認した問題の履歴を端末内で確認できます。",
			noindex: true,
		},
	),
);
