/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import GuideContent from "../content/guide.mdx";

// 使い方ガイド。
// 本文は app/content/guide.mdx を @mdx-js/rollup が hono/jsx コンポーネントへ
// コンパイルしたものを SSR で描画する（旧 lobster.js の外部 CDN 依存は廃止）。
export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="container mx-auto px-4 py-8 max-w-3xl">
				<article class="prose prose-slate max-w-none">
					<GuideContent />
				</article>
			</main>
		</>,
		{ title: "使い方ガイド - 基本情報技術 I" },
	),
);
