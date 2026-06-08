/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../../components/Header";
import { USER_ID_KEY } from "../../constants";

// ダッシュボード入口（localStorage の userId へリダイレクト）。
// userId があれば個別ダッシュボード（/dashboard/{userId}/）へ、なければ空状態を見せる。
// 判定は localStorage 依存のため inline script（ルート HTML）として出力する。
const REDIRECT_SCRIPT = `const userId = (() => {
	try {
		return localStorage.getItem("${USER_ID_KEY}");
	} catch {
		return null;
	}
})();
if (userId) {
	location.replace("/dashboard/" + userId);
} else {
	document.getElementById("dash-loading")?.setAttribute("hidden", "");
	document.getElementById("dash-empty")?.removeAttribute("hidden");
}`;

export default createRoute((c) =>
	c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="mx-auto max-w-2xl px-4 py-16 text-center">
					<div id="dash-loading">
						<p class="text-slate-500">読み込み中…</p>
					</div>
					<div id="dash-empty" hidden>
						<h1 class="text-2xl font-bold text-[#1e3a5f]" style="font-family: var(--font-serif)">
							まだ記録がありません
						</h1>
						<p class="mt-3 text-slate-600">
							問題を解くと、ここに学習の進捗が表示されます。まずは今日のぶんから。
						</p>
						<a href="/" class="q-btn-primary mt-6 inline-block w-auto px-6">
							今日の道を始める
						</a>
					</div>
				</div>
			</main>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: localStorage 判定の inline script 移植 */}
			<script type="module" dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
		</>,
		{ title: "学習ダッシュボード - 基本情報技術 I", noindex: true },
	),
);
