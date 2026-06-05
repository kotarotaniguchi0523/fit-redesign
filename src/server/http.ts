import type { APIContext } from "astro";

/**
 * API ルートの共通土台。
 *
 * - JSON レスポンス生成（`json` / `badRequest` / `serverError`）
 * - `route()` が try/catch と `cloudflare:workers` の env 注入を引き受ける
 *
 * レスポンスの形は既存挙動と byte 一致させる（エンベロープ統一はしない）。
 */

export interface RouteContext {
	context: APIContext;
	env: Cloudflare.Env;
	db: D1Database;
}

type RouteHandler = (ctx: RouteContext) => Promise<Response>;

/** `Content-Type: application/json` 付きのレスポンスを生成する。 */
export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** Zod バリデーション失敗時の 400。`details` には `error.issues` を渡す。 */
export function badRequest(issues: unknown): Response {
	return json({ error: "Invalid request", details: issues }, 400);
}

/** 予期せぬ例外時の 500。 */
export function serverError(): Response {
	return json({ error: "Internal server error" }, 500);
}

/**
 * API ハンドラを try/catch + env 注入でラップする。
 * `label` は失敗時の `console.error` ラベル。
 */
export function route(label: string, handler: RouteHandler) {
	return async (context: APIContext): Promise<Response> => {
		try {
			const { env } = await import("cloudflare:workers");
			return await handler({ context, env, db: env.DB });
		} catch (error) {
			console.error(label, error);
			return serverError();
		}
	};
}
