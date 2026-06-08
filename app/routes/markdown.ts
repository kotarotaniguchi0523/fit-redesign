import { type Context, Hono } from "hono";
import { etag } from "hono/etag";
import { renderMarkdown } from "../features/markdown/markdownContent";
import type { Env } from "./_lib";

// /markdown（サイト概要）と /markdown/{unit}/{year}（単元）を扱う sub-app。
// 基底＋ワイルドカードの二重経路のため per-endpoint ではなく Hono インスタンスで分離する。
// ETag は markdown 配下にスコープ（If-None-Match 一致で 304）。
async function respond(c: Context<Env>, path: string): Promise<Response> {
	const { status, body } = await renderMarkdown(path);
	if (status === 200) {
		return c.body(body, 200, {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		});
	}
	return c.body(body, status as 404);
}

const markdown = new Hono<Env>()
	.use("*", etag())
	.get("/", (c) => respond(c, ""))
	.get("/*", (c) => respond(c, c.req.path.slice("/markdown/".length)));

export default markdown;
