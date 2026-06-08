interface HeaderProps {
	/** 現在のパス名（Astro.url.pathname の代替。ルート側で c.req.path を渡す）。 */
	currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
	const isGuide = currentPath === "/guide" || currentPath === "/guide/";
	const isDashboard = currentPath.startsWith("/dashboard");

	return (
		<>
			<nav class="sticky top-0 z-50 w-full bg-linear-to-r from-[#1e3a5f] to-[#152a45] text-white border-b-2 border-[#c9a227] shadow-md">
				<div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
					<a href="/" class="flex items-center gap-4 no-underline text-white">
						<div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
							<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linejoin="round"
								/>
								<path
									d="M7 10v4.2c0 1.6 2.2 2.8 5 2.8s5-1.2 5-2.8V10"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						</div>
						<div class="flex flex-col">
							<span class="text-lg font-bold tracking-wide" style="font-family: var(--font-serif)">
								基本情報技術 I
							</span>
							<span class="text-xs tracking-widest text-white/70">明治大学</span>
						</div>
					</a>

					<div class="flex items-center gap-4">
						{!isDashboard && (
							<a
								id="dashboard-link"
								href="/dashboard/"
								class="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
							>
								<span class="hidden sm:inline">学習進捗</span>
								<span class="sm:hidden">進捗</span>
							</a>
						)}
						<a
							href={isGuide ? "/" : "/guide"}
							class="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
						>
							{isGuide ? (
								<>
									<span>←</span>
									<span class="hidden sm:inline">ホームに戻る</span>
									<span class="sm:hidden">戻る</span>
								</>
							) : (
								<>
									<span class="hidden sm:inline">使い方ガイド</span>
									<span class="sm:hidden">使い方</span>
								</>
							)}
						</a>
					</div>
				</div>
			</nav>

			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: ダッシュボードリンクに localStorage の userId を付与するクライアントスクリプト */}
			<script
				dangerouslySetInnerHTML={{
					__html: `
	// ダッシュボードリンクに userId を付与
	const link = document.getElementById("dashboard-link");
	if (link) {
		try {
			const userId = localStorage.getItem("fit-exam-user-id");
			if (userId) {
				link.href = \`/dashboard/\${userId}/\`;
			}
		} catch {
			// localStorage 未対応の場合は /dashboard/ のまま
		}
	}
`,
				}}
			/>
		</>
	);
}
