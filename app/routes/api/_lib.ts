import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createFactory } from "hono/factory";
import { z } from "zod";
import { renderMarkdown } from "../../features/markdown/markdownContent";

/**
 * API ルート群（app/routes/api/**）の共有基盤。`_` 接頭辞のため HonoX のルーティング対象外。
 *
 * `apiRoute` は Bindings(D1/KV) を型付けした createRoute。各エンドポイントファイルは
 * `export default apiRoute(...)`（GET）/ `export const POST = apiRoute(...)` のように使う。
 * cross-cutting middleware は app/routes/api/_middleware.ts（logger/request-id/timing）と
 * app/routes/api/markdown/_middleware.ts（etag）に置く。
 */
export type Env = { Bindings: Cloudflare.Env };

export const apiRoute = createFactory<Env>().createHandlers;

/** Zod バリデーション失敗時のレスポンス（{ error, details } 形状を全ルートで統一）。 */
export function invalid(c: Context, issues: unknown): Response {
	return c.json({ error: "Invalid request", details: issues }, 400);
}

export const UserIdQuerySchema = z.object({ userId: z.string().min(1) });
export const ClearQuerySchema = z.object({
	userId: z.string().min(1),
	questionId: z.string().min(1),
});

const AttemptSchema = z.object({
	timestamp: z.number(),
	duration: z.number().nonnegative(),
	mode: z.enum(["stopwatch", "countdown"]),
	completed: z.boolean(),
	targetTime: z.number().optional(),
});
const RecordSchema = z.object({
	questionId: z.string(),
	attempts: z.array(AttemptSchema),
});
export const SyncRequestSchema = z.object({
	userId: z.string().min(1),
	records: z.record(z.string(), RecordSchema),
});

/** POST ボディの上限（過大ペイロードは 413）。timer sync の正当なデータを十分上回るサイズ。 */
const POST_BODY_LIMIT = 256 * 1024;
export const postBodyLimit = bodyLimit({ maxSize: POST_BODY_LIMIT });

/** markdown レンダリング結果を Content-Type / Cache-Control 付きで返す（overview / unit 共通）。 */
export async function markdownResponse(c: Context, path: string): Promise<Response> {
	const { status, body } = await renderMarkdown(path);
	if (status === 200) {
		return c.body(body, 200, {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		});
	}
	return c.body(body, status as 404);
}
