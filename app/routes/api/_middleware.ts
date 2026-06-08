import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { createRoute } from "honox/factory";

// /api/* 配下すべてに適用（HonoX が subApp.use("*", ...) する）。
// Must: 構造化ログ / Nice: request-id・Server-Timing。
export default createRoute(logger(), requestId(), timing());
