/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { PageHeading } from "../components/PageHeading";
import { unitBasedTabs } from "../data/units";
import ProgressHistory from "../features/progress/$ProgressHistory";
import SyncSettings from "../features/progress/$SyncSettings";

const unitNames = Object.fromEntries(unitBasedTabs.map((unit) => [unit.id, unit.name]));

export default createRoute((c) => {
	const origin = new URL(c.req.url).origin;
	return c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container">
				<PageHeading
					eyebrow="任意機能"
					title="学習記録"
					description="答えを確認した問題を、この端末に記録します。"
				/>
				<div class="space-y-6">
					<ProgressHistory unitNames={unitNames} />
					<details class="content-panel p-0!">
						<summary class="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4">
							<span>
								<strong class="block text-[#1e3a5f]">端末間で同期</strong>
								<small class="text-gray-500">必要な場合だけ設定します</small>
							</span>
							<span class="study-navigator__action">設定を開く</span>
						</summary>
						<div class="border-t border-gray-200 px-5 pb-5 pt-4">
							<p class="text-sm leading-6 text-gray-600">
								ログインは不要です。秘密の同期リンクを別の端末で開くと、記録を統合できます。
							</p>
							<p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
								リンクを知っている人は記録を読み書きできます。他人に送らないでください。リンクを失うと復元できません。
							</p>
							<SyncSettings origin={origin} />
						</div>
					</details>
				</div>
			</div>
		</main>,
		{
			title: "学習記録 - 基本情報技術 I",
			description: "答えを確認した問題の履歴を端末内で確認できます。",
			noindex: true,
		},
	);
});
