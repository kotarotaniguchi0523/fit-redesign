import type { JSX } from "hono/jsx/jsx-runtime";

interface HeaderProps {
	/** 現在のパス名。ルート側で c.req.path を渡す。 */
	currentPath: string;
}

const QUIZ_PATH_PATTERN = /^\/unit-[^/]+\/\d{4}\/?$/;

export function Header({ currentPath }: HeaderProps): JSX.Element {
	let active: "quiz" | "records" | "slides" | "guide" | null = null;
	if (currentPath.startsWith("/records")) {
		active = "records";
	} else if (currentPath.startsWith("/slide-only")) {
		active = "slides";
	} else if (currentPath.startsWith("/guide")) {
		active = "guide";
	} else if (currentPath === "/" || QUIZ_PATH_PATTERN.test(currentPath)) {
		active = "quiz";
	}
	const links = [
		{ id: "quiz", href: "/", label: "問題" },
		{ id: "records", href: "/records", label: "学習記録" },
		{ id: "slides", href: "/slide-only", label: "講義資料" },
		{ id: "guide", href: "/guide", label: "使い方" },
	];

	return (
		<nav aria-label="メインナビゲーション" class="site-header">
			<div class="site-header__inner">
				<a href="/" class="site-brand">
					<div class="site-brand__mark">
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
					<div class="site-brand__text">
						<span class="site-brand__title">基本情報技術 I</span>
						<span class="site-brand__meta">明治大学</span>
					</div>
				</a>
				<div class="site-nav site-nav--desktop">
					{links.map((link) => (
						<a href={link.href} aria-current={active === link.id ? "page" : undefined}>
							{link.label}
						</a>
					))}
				</div>
				<details class="site-menu">
					<summary aria-label="メニューを開く">メニュー</summary>
					<div class="site-menu__panel">
						{links.map((link) => (
							<a href={link.href} aria-current={active === link.id ? "page" : undefined}>
								{link.label}
							</a>
						))}
					</div>
				</details>
			</div>
		</nav>
	);
}
