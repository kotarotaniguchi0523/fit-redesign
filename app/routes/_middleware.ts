import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { createRoute } from "honox/factory";

// app/routes/ 直下に置いているため全ルート（ページ + API エンドポイント）に適用される
// （HonoX が subApp.use("*", ...) する）。Must: 構造化ログ / Nice: request-id・Server-Timing。
export default createRoute(logger(), requestId(), timing());
