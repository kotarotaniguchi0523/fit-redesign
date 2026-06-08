import { Hono } from "hono";
import { createApp } from "honox/server";
import api from "./api";

// Hono RPC API(app/api.ts)を /api に明示マウントしてから、honox のファイルルートを合成する。
// (honox のファイルルート経由での Hono インスタンスマウントはパス導出が噛み合わないため、
//  composition root で明示的に app.route する。)
const app = new Hono();
app.route("/api", api);

export default createApp({ app });
