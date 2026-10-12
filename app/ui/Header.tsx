import type { Handle } from "remix/component";
import { css } from "remix/component";

import { routes } from "../routes.ts";

const QUIZ_PATH_PATTERN = /^\/unit-[^/]+\/\d{4}\/?$/;

const navStyle = css({
	position: "sticky",
	top: 0,
	zIndex: 20,
	background: "rgba(255, 255, 255, 0.92)",
	backdropFilter: "blur(8px)",
	borderBottom: "1px solid var(--color-border)",
});

const innerStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "0.75rem",
	maxWidth: "72rem",
	margin: "0 auto",
	padding: "0.5rem 1rem",
});

const brandStyle = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "0.5rem",
	textDecoration: "none",
	color: "var(--color-primary)",
});

const brandTitleStyle = css({
	display: "block",
	fontWeight: 700,
	fontSize: "0.95rem",
	lineHeight: 1.2,
});

const brandMetaStyle = css({
	display: "block",
	fontSize: "0.7rem",
	color: "var(--color-text-muted)",
});

const linkListStyle = css({
	display: "flex",
	gap: "0.25rem",
});

const linkStyle = css({
	padding: "0.375rem 0.625rem",
	borderRadius: "0.375rem",
	fontSize: "0.875rem",
	textDecoration: "none",
	color: "var(--color-text-muted)",
	'&[aria-current="page"]': {
		color: "var(--color-primary)",
		background: "var(--color-primary-soft)",
		fontWeight: 600,
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

export function Header(handle: Handle<{ currentPath: string }>) {
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
					<div mix={linkListStyle}>
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
				</div>
			</nav>
		);
	};
}
