/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";

// 旧 src/pages/guide.astro を HonoX ルートへ移植。
// lobster.js（外部の Markdown レンダラ）を inline module script で読み込み、
// /guide-content.md を #guide-content に描画する。これはルートの HTML であり
// app/client.ts（凍結）の配線ではないため、dangerouslySetInnerHTML で出力する。
const LOBSTER_LOADER = `import { loadMarkdown } from "https://hacknock.github.io/lobsterjs/lobster.js";
const el = document.getElementById("guide-content");
if (el) {
	loadMarkdown("/guide-content.md", el);
}`;

export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="container mx-auto px-4 py-8 max-w-3xl">
				<div id="guide-content">読み込み中...</div>
			</main>
			<link rel="stylesheet" href="https://hacknock.github.io/lobsterjs/themes/formal.css" />
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: 旧 Astro inline module script の移植 */}
			<script type="module" dangerouslySetInnerHTML={{ __html: LOBSTER_LOADER }} />
		</>,
		{ title: "使い方ガイド - 基本情報技術 I" },
	),
);
