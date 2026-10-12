/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import GuideContent from "../content/guide.mdx";

// 使い方ガイド。
// 本文は app/content/guide.mdx を @mdx-js/rollup が hono/jsx コンポーネントへ
// コンパイルしたものを SSR で描画する（旧 lobster.js の外部 CDN 依存は廃止）。
export default createRoute((c) =>
	c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container max-w-3xl">
				<article class="content-panel prose prose-slate max-w-none">
					<GuideContent />
				</article>
			</div>
		</main>,
		{ title: "使い方ガイド - 基本情報技術 I" },
	),
);
