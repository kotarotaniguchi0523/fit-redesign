import { zValidator } from "@hono/zod-validator";
import type { Context, ValidationTargets } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createFactory } from "hono/factory";
import type { ZodType } from "zod";
import type { UserIdentityVariables } from "../server/userIdentity";

/**
 * API エンドポイント（health / answer / timer / markdown）の共有 plumbing。`_` 接頭辞のため
 * HonoX のルーティング対象外。API は /api プレフィックス無しで root 直下に置く。
 *
 * 主形態は機能ごとの chained Hono sub-app（answer.ts / timer.ts / markdown.ts）で、検証は `validate`
 * を使い hc 用に型を export する。health 等の単発エンドポイントは `apiRoute`（Bindings(D1/KV) を型付けした
 * createRoute。honox の createRoute は Bindings 空のため必要）で `export default apiRoute(...)`(GET) でよい。
 * cross-cutting middleware は app/routes/_middleware.ts（logger/request-id/timing、全ルート適用）。
 * 機能固有スキーマは features/<x>/、複数機能横断スキーマは types/ に置く（ここには集約しない）。
 */
export type Env = { Bindings: Cloudflare.Env; Variables: UserIdentityVariables };

export const apiRoute = createFactory<Env>().createHandlers;

/** Zod バリデーション失敗時のレスポンス（{ error, details } 形状を全ルートで統一）。 */
export function invalid(c: Context, issues: unknown): Response {
	return c.json({ error: "Invalid request", details: issues }, 400);
}

/**
 * zValidator + 統一 400（invalid）のラッパ。各 sub-app の検証フックの重複を 1 箇所に集約する。
 * 注意: zValidator に明示型引数を渡すと hc の型推論が落ちるため、schema 引数からの推論に委ねる。
 */
// biome-ignore lint/nursery/useExplicitReturnType: zValidator の返す MiddlewareHandler 型を明示すると hc の型推論が落ちる（schema からの推論に委ねる）
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
	target: Target,
	schema: T,
) {
	return zValidator(target, schema, (r, c) => {
		if (!r.success) {
			return invalid(c, r.error.issues);
		}
	});
}

/** POST ボディの上限（過大ペイロードは 413）。timer sync の正当なデータを十分上回るサイズ。 */
const POST_BODY_LIMIT = 256 * 1024;
export const postBodyLimit = bodyLimit({ maxSize: POST_BODY_LIMIT });
