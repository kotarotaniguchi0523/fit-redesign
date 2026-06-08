import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import { Link } from "honox/server";
import { ClientScript } from "../client-script";
import { SITE_URL } from "../../src/data/site";

const SITE = SITE_URL;
const SITE_NAME = "基本情報技術 I - 明治大学";
const DEFAULT_DESC = "明治大学 基本情報技術 I 演習問題サイト";

export default jsxRenderer(({ children, title, description, jsonLd, noindex }) => {
	const c = useRequestContext();
	const canonical = new URL(c.req.path, SITE).href;
	const desc = description ?? DEFAULT_DESC;
	return (
		<html lang="ja">
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="description" content={desc} />
				{noindex ? <meta name="robots" content="noindex, follow" /> : null}
				<link rel="canonical" href={canonical} />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<meta property="og:type" content="website" />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={desc} />
				<meta property="og:url" content={canonical} />
				<meta property="og:site_name" content={SITE_NAME} />
				<meta property="og:locale" content="ja_JP" />
				<meta name="twitter:card" content="summary" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={desc} />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
				<link
					href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap"
					rel="stylesheet"
				/>
				{jsonLd ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 構造化データの注入
					<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
				) : null}
				<Link href="/app/style.css" rel="stylesheet" />
				<ClientScript src="/app/client.ts" />
				<title>{title}</title>
			</head>
			<body class="min-h-screen bg-[#faf9f7] bg-texture">{children}</body>
		</html>
	);
});
