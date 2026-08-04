import { createRoute } from "honox/factory";
import { SITE_URL } from "../data/site";

/**
 * robots.txt。Sitemap URL を SITE_URL から動的生成し静的ファイルのドメインドリフトを解消する。
 * 学習記録と同期 API は検索対象外にする。
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
		"Disallow: /records",
		"Disallow: /progress/",
		"",
		`Sitemap: ${SITE_URL}/sitemap.xml`,
		"",
	].join("\n");
	c.header("Cache-Control", "public, max-age=86400");
	return c.text(body);
});
