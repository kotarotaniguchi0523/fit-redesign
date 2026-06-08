import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createFactory } from "hono/factory";

/**
 * API エンドポイント（health / answer / timer / markdown）の共有 plumbing。`_` 接頭辞のため
 * HonoX のルーティング対象外。API は /api プレフィックス無しで root 直下に置く。
 *
 * `apiRoute` は Bindings(D1/KV) を型付けした createRoute（honox の createRoute は Bindings 空のため必要）。
 * 各エンドポイントは `export default apiRoute(...)`（GET）/ `export const POST = apiRoute(...)` で使う。
 * cross-cutting middleware は app/routes/_middleware.ts（logger/request-id/timing、全ルート適用）。
 * 機能固有スキーマは features/<x>/、複数機能横断スキーマは types/ に置く（ここには集約しない）。
 */
export type Env = { Bindings: Cloudflare.Env };

export const apiRoute = createFactory<Env>().createHandlers;

/** Zod バリデーション失敗時のレスポンス（{ error, details } 形状を全ルートで統一）。 */
export function invalid(c: Context, issues: unknown): Response {
	return c.json({ error: "Invalid request", details: issues }, 400);
}

/** POST ボディの上限（過大ペイロードは 413）。timer sync の正当なデータを十分上回るサイズ。 */
const POST_BODY_LIMIT = 256 * 1024;
export const postBodyLimit = bodyLimit({ maxSize: POST_BODY_LIMIT });
