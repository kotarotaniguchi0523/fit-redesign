import * as menu from "@remix-run/ui/menu";
import type { Handle } from "remix/component";
import { clientEntry, css, on } from "remix/component";

import { routes } from "../routes.ts";

const QUIZ_PATH_PATTERN = /^\/unit-[^/]+\/\d{4}\/?$/;

const navStyle = css({
	position: "sticky",
	top: 0,
	zIndex: 50,
	background: "linear-gradient(110deg, #1e3a5f, #152a45)",
	color: "#fff",
	borderBottom: "2px solid var(--color-accent)",
	boxShadow: "0 4px 16px rgba(15, 23, 42, 0.16)",
});

const innerStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "0.75rem",
	maxWidth: "56rem",
	margin: "0 auto",
	padding: "0.5rem 1rem",
	minHeight: "64px",
});

const brandStyle = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5rem",
	color: "#fff",
	textDecoration: "none",
});

const brandTitleStyle = css({
	display: "block",
	fontFamily: "var(--font-serif)",
	fontWeight: 700,
	fontSize: "1rem",
	lineHeight: 1.3,
});

const brandMetaStyle = css({ display: "block", fontSize: "0.7rem", opacity: 0.8 });

const desktopListStyle = css({
	display: "none",
	gap: "0.25rem",
	"@media (min-width: 40rem)": { display: "flex" },
});

const linkStyle = css({
	padding: "0.375rem 0.625rem",
	borderRadius: "var(--radius-control)",
	fontSize: "0.875rem",
	textDecoration: "none",
	color: "rgba(255,255,255,0.82)",
	'&[aria-current="page"]': {
		color: "#fff",
		background: "rgba(255,255,255,0.14)",
		fontWeight: 600,
	},
});

const mobileTriggerStyle = css({
	display: "inline-flex",
	padding: "0.375rem 0.625rem",
	border: "1px solid rgba(255,255,255,0.4)",
	borderRadius: "var(--radius-control)",
	background: "transparent",
	color: "#fff",
	font: "inherit",
	cursor: "pointer",
	"@media (min-width: 40rem)": { display: "none" },
});

const menuSurfaceStyle = css({
	padding: "0.5rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-card)",
	boxShadow: "var(--shadow-card)",
	"& a": {
		display: "block",
		padding: "0.5rem 0.75rem",
		borderRadius: "var(--radius-control)",
		color: "var(--color-primary)",
		textDecoration: "none",
	},
});

type NavId = "quiz" | "records" | "slides" | "guide";

function activeFor(currentPath: string): NavId | null {
	if (currentPath.startsWith("/records")) {
		return "records";
	}
	if (currentPath.startsWith("/slide-only")) {
		return "slides";
	}
	if (currentPath.startsWith("/guide")) {
		return "guide";
	}
	if (currentPath === "/" || QUIZ_PATH_PATTERN.test(currentPath)) {
		return "quiz";
	}
	return null;
}

/**
 * サイトヘッダー（clientEntry）。狭い画面では `@remix-run/ui/menu` に
 * ナビゲーションを畳む。プリミティブはハイドレーション後に動作する。
 */
export const Header = clientEntry(
	"/assets/client.js#Header",
	function HeaderEntry(handle: Handle<{ currentPath: string }>) {
		let menuOpen = false;

		return () => {
			const { currentPath } = handle.props;
			const active = activeFor(currentPath);
			const links: ReadonlyArray<{ id: NavId; href: string; label: string }> = [
				{ id: "quiz", href: routes.home.href(), label: "問題" },
				{ id: "records", href: routes.records.href(), label: "学習記録" },
				{ id: "slides", href: routes.slideOnly.href(), label: "講義資料" },
				{ id: "guide", href: routes.guide.href(), label: "使い方" },
			];

			return (
				<nav aria-label="メインナビゲーション" mix={navStyle}>
					<div mix={innerStyle}>
						<a href={routes.home.href()} mix={brandStyle}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
							<span>
								<span mix={brandTitleStyle}>基本情報技術 I</span>
								<span mix={brandMetaStyle}>明治大学</span>
							</span>
						</a>

						<div mix={desktopListStyle}>
							{links.map((link) => (
								<a
									key={link.id}
									href={link.href}
									mix={linkStyle}
									aria-current={active === link.id ? "page" : undefined}
								>
									{link.label}
								</a>
							))}
						</div>

						<menu.Context label="メニュー">
							<button
								type="button"
								mix={[
									mobileTriggerStyle,
									menu.trigger(),
									on("click", () => {
										menuOpen = !menuOpen;
										void handle.update();
									}),
								]}
								aria-expanded={menuOpen ? "true" : "false"}
							>
								メニュー
							</button>
							{menuOpen ? (
								<div mix={[menuSurfaceStyle, menu.popover()]}>
									{links.map((link) => (
										<a
											key={link.id}
											href={link.href}
											aria-current={active === link.id ? "page" : undefined}
											mix={on("click", () => {
												menuOpen = false;
												void handle.update();
											})}
										>
											{link.label}
										</a>
									))}
								</div>
							) : null}
						</menu.Context>
					</div>
				</nav>
			);
		};
	},
);
