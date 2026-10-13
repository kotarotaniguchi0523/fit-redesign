import type { Handle, RemixNode } from "remix/component";
import { css } from "remix/component";
import { ImportMap } from "remix/component/server";

import { CLIENT_ENTRY_HREF } from "../client-entry.ts";
import { scriptEntry } from "../content/assets.generated.ts";

import { SITE_URL } from "../data/site.ts";
import { Header } from "../ui/header.tsx";

const SITE_NAME = "基本情報技術 I - 明治大学";
const DEFAULT_DESCRIPTION = "明治大学 基本情報技術 I 演習問題サイト";

export interface DocumentProps {
	children?: RemixNode;
	head?: RemixNode;
	title: string;
	description?: string;
	canonicalPath?: string;
	noCanonical?: boolean;
	noindex?: boolean;
	jsonLd?: unknown;
	currentPath?: string;
}

const bodyStyle = css({
	"min-height": "100vh",
	background: "var(--color-bg)",
});

const skipLinkStyle = css({
	position: "absolute",
	left: "-9999px",
	top: 0,
	"&:focus": {
		left: "0.5rem",
		top: "0.5rem",
		zIndex: 100,
		background: "var(--color-primary)",
		color: "#fff",
		padding: "0.5rem 0.75rem",
		borderRadius: "0.375rem",
	},
});

/**
 * すべてのページが通る Document シェル。
 * 旧 `app/routes/_renderer.tsx`（HonoX jsxRenderer）の meta / canonical / OG /
 * フォント / グローバルスタイルを Remix コンポーネントへ移植したもの。
 * グローバル CSS は Workers Assets が配信する `/style.css`。
 */
export function Document(handle: Handle<DocumentProps>) {
	return () => {
		const {
			children,
			head,
			title,
			description = DEFAULT_DESCRIPTION,
			canonicalPath,
			noCanonical,
			noindex,
			jsonLd,
			currentPath = "/",
		} = handle.props;

		const canonical = noCanonical ? null : new URL(canonicalPath ?? currentPath, SITE_URL).href;

		return (
			<html lang="ja">
				<head>
					<meta charSet="UTF-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<meta name="description" content={description} />
					{noindex ? <meta name="robots" content="noindex, follow" /> : null}
					{canonical ? <link rel="canonical" href={canonical} /> : null}
					<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
					<meta property="og:type" content="website" />
					<meta property="og:title" content={title} />
					<meta property="og:description" content={description} />
					{canonical ? <meta property="og:url" content={canonical} /> : null}
					<meta property="og:site_name" content={SITE_NAME} />
					<meta property="og:locale" content="ja_JP" />
					<meta name="twitter:card" content="summary" />
					<meta name="twitter:title" content={title} />
					<meta name="twitter:description" content={description} />
					<link rel="preconnect" href="https://fonts.googleapis.com" />
					<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
					<link
						href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap"
						rel="stylesheet"
					/>
					<link rel="stylesheet" href="/style.css" />
					<ImportMap value={scriptEntry.importMap} />
					{scriptEntry.preloads.slice(0, 1).map((preload) => (
						<link key={preload} rel="modulepreload" href={preload} />
					))}
					<script type="module" src={CLIENT_ENTRY_HREF}></script>
					{jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
					{head}
					<title>{title}</title>
				</head>
				<body mix={bodyStyle}>
					<a href="#main-content" mix={skipLinkStyle}>
						本文へスキップ
					</a>
					<Header currentPath={currentPath} />
					{children}
				</body>
			</html>
		);
	};
}
