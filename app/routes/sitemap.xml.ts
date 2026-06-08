import { createRoute } from "honox/factory";
import { SITE_URL } from "../data/site";
import { unitBasedTabs } from "../data/units";

/** sitemap.xml。全静的/単元×年度ルートを列挙。 */
const BASE = SITE_URL;

export default createRoute((c) => {
	const urls = new Set<string>(["/", "/guide", "/slide-only"]);
	for (const tab of unitBasedTabs) {
		for (const mapping of tab.examMapping) {
			urls.add(`/${tab.id}/${mapping.year}`);
		}
		urls.add(`/today/${tab.id}`);
	}
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
		...urls,
	]
		.map((u) => `  <url><loc>${BASE}${u}</loc></url>`)
		.join("\n")}\n</urlset>\n`;
	c.header("Content-Type", "application/xml; charset=utf-8");
	c.header("Cache-Control", "public, max-age=86400");
	return c.body(body);
});
