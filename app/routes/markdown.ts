import { type Context, Hono } from "hono";
import { etag } from "hono/etag";
import { ssgParams } from "hono/ssg";
import { unitBasedTabs } from "../data/units";
import { renderMarkdown } from "../features/markdown/markdownContent";
import type { Env } from "./_lib";

// /markdown（サイト概要）と /markdown/{unit}/{year}（単元）を扱う sub-app。
// Hono インスタンス内で ETag をスコープし、If-None-Match 一致時は304を返す。
async function respond(c: Context<Env>, path: string): Promise<Response> {
	const { status, body } = await renderMarkdown(path);
	if (status === 200) {
		return c.body(body, 200, {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		});
	}
	return c.body(body, status);
}

const markdown = new Hono<Env>()
	.use("*", etag())
	.get("/", (c) => respond(c, ""))
	.get(
		"/:unit/:year",
		ssgParams(() =>
			unitBasedTabs.flatMap((unit) =>
				unit.examMapping.map((mapping) => ({ unit: unit.id, year: mapping.year })),
			),
		),
		(c) => respond(c, `${c.req.param("unit")}/${c.req.param("year")}`),
	)
	.get("/*", (c) => respond(c, c.req.path.slice("/markdown/".length)));

export default markdown;
