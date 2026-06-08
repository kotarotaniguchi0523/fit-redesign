/** @jsxImportSource hono/jsx */
import type { NotFoundHandler } from "hono";
import { Header } from "../components/Header";

// 旧 src/pages/404.astro を HonoX の 404 規約（_404.tsx + NotFoundHandler）へ移植。
const handler: NotFoundHandler = (c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="mx-auto max-w-2xl px-4 py-20 text-center">
					<p class="text-sm font-bold tracking-[0.18em] text-[#c9a227]">404</p>
					<h1
						class="mt-3 text-2xl font-bold text-[#1e3a5f] sm:text-3xl"
						style="font-family: var(--font-serif)"
					>
						ページが見つかりません
					</h1>
					<p class="mt-4 leading-7 text-slate-600">
						お探しのページは移動したか、存在しません。
						<br />
						トップから単元を選んで、今日のぶんを始めましょう。
					</p>
					<div class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
						<a href="/" class="q-btn-primary inline-block w-auto px-6">
							ホームに戻る
						</a>
						<a href="/slide-only" class="home-textlink">
							講義資料だけ見る
						</a>
					</div>
				</div>
			</main>
		</>,
		{ title: "ページが見つかりません - 基本情報技術 I", noindex: true },
	);

export default handler;
