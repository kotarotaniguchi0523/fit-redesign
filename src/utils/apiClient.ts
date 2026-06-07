import { hc } from "hono/client";
import type { ApiType } from "../api";

/**
 * 同一オリジンの Hono RPC API を型付きで呼ぶブラウザクライアント。
 * `ApiType` は type-only import のためクライアントバンドルにサーバーコードは入らない。
 * 例: `apiClient.api.answer.status.$get({ query: { userId } })`
 */
export const apiClient = hc<ApiType>("/");
