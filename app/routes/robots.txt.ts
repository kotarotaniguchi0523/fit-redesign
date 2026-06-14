import { createRoute } from "honox/factory";
import { SITE_URL } from "../data/site";

/**
 * robots.txt。Sitemap URL を SITE_URL から動的生成し静的ファイルのドメインドリフトを解消する。
 * 廃止済みの /timer/ Disallow は除去し /answer/ /dashboard/ のみ残す。
 * AI 検索ボットは全許可（配列から flatMap で生成）。
 */
const AI_SEARCH_BOTS = [
	"GPTBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Anthropic-ai",
	"PerplexityBot",
	"Google-Extended",
	"Googlebot",
	"Bingbot",
] as const;

export default createRoute((c) => {
	const botLines = AI_SEARCH_BOTS.flatMap((bot) => [`User-agent: ${bot}`, "Allow: /", ""]);
	const body = [
		"# AI Search Engine Bots - Allowed",
		...botLines,
		"User-agent: *",
		"Allow: /",
		"Disallow: /answer/",
		"Disallow: /dashboard/",
		"",
		`Sitemap: ${SITE_URL}/sitemap.xml`,
		"",
	].join("\n");
	c.header("Content-Type", "text/plain; charset=utf-8");
	c.header("Cache-Control", "public, max-age=86400");
	return c.body(body);
});
