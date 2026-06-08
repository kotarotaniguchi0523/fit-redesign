import { Hono } from "hono";
import { etag } from "hono/etag";
import { type Env, markdownResponse } from "./_lib";

// /api/markdown（サイト概要）と /api/markdown/{unit}/{year}（単元）を扱う sub-app。
// 基底＋ワイルドカードの二重経路のため per-endpoint ではなく Hono インスタンスで分離する。
// ETag は markdown 配下にスコープ（If-None-Match 一致で 304）。
const markdown = new Hono<Env>()
	.use("*", etag())
	.get("/", (c) => markdownResponse(c, ""))
	.get("/*", (c) => markdownResponse(c, c.req.path.slice("/api/markdown/".length)));

export default markdown;
