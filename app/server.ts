import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createApp } from "honox/server";
import api from "./api";

// 末尾スラッシュ付き URL（旧 Astro は /dashboard/ 形式で出力していた）を正規化。
// honox/Workers のファイルルートは末尾スラッシュを別パス扱いで 404 にするため、
// /path/ → /path へ 301 して既存ブックマーク・内部リンクを救済する（"/" は対象外）。
const app = new Hono();
app.use(trimTrailingSlash());

// Hono RPC API(app/api.ts)を /api に明示マウントしてから、honox のファイルルートを合成する。
// (honox のファイルルート経由での Hono インスタンスマウントはパス導出が噛み合わないため、
//  composition root で明示的に app.route する。)
app.route("/api", api);

export default createApp({ app });
