import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { timing } from "hono/timing";
import { z } from "zod";
import { renderMarkdown } from "./features/markdown/markdownContent";
import {
	clearUserQuestionRecords,
	loadUserAttempts,
	syncAttempts,
} from "./features/timer/timerRepository";
import { getAnswerStatuses, updateAnswerStatus } from "./server/answerCache";
import { getUserAnswerHistory, insertAnswer } from "./server/answerRepository";
import { upsertUser } from "./server/userRepository";
import { AnswerSubmitSchema } from "./types/answer";

/**
 * Hono RPC API。7 ルート（answer / timer / markdown）を 1 つのチェーンで定義し、
 * `hc<ApiType>` で型付きクライアント呼び出しを可能にする。
 *
 * - レスポンスは旧 src/pages/api/* と byte 一致（同じ JSON 形状・同じ markdown ヘッダ）。
 * - バリデーション失敗時の 400 も旧 `badRequest`（{ error, details }）と一致させる。
 * - bindings は c.env（DB / CACHE）から取得する。
 */

type Env = { Bindings: Cloudflare.Env };

/** Zod バリデーション失敗時のレスポンス（旧 server/http.ts の badRequest と byte 一致）。 */
function invalid(c: Context, issues: unknown): Response {
	return c.json({ error: "Invalid request", details: issues }, 400);
}

const UserIdQuerySchema = z.object({ userId: z.string().min(1) });
const ClearQuerySchema = z.object({
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
const SyncRequestSchema = z.object({
	userId: z.string().min(1),
	records: z.record(z.string(), RecordSchema),
});

/** POST ボディの上限（過大ペイロードは 413）。timer sync の正当なデータを十分上回るサイズ。 */
const POST_BODY_LIMIT = 256 * 1024;
const postBodyLimit = bodyLimit({ maxSize: POST_BODY_LIMIT });

const api = new Hono<Env>()
	// Must: 構造化ログ / Nice: request-id・Server-Timing。
	// /api/* に限定する（app.route("/", api) でマウントするため、無指定だと
	// 全ページ・静的ファイルに波及し、prerender 済みの immutable ヘッダを変更して 500 化する）。
	.use("/api/*", logger())
	.use("/api/*", requestId())
	.use("/api/*", timing())
	// Nice: markdown は ETag で If-None-Match → 304
	.use("/api/markdown/*", etag())
	.use("/api/markdown", etag())
	.post(
		"/api/answer/submit",
		postBodyLimit,
		zValidator("json", AnswerSubmitSchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId, questionId, selectedLabel, isCorrect, duration, timestamp } =
				c.req.valid("json");
			const answerId = await insertAnswer(
				c.env.DB,
				userId,
				questionId,
				selectedLabel,
				isCorrect,
				duration ?? null,
				timestamp,
			);
			try {
				await updateAnswerStatus(c.env.CACHE, userId, questionId, {
					label: selectedLabel,
					isCorrect,
				});
			} catch {
				// KV 失敗は無視（D1 が信頼源）
			}
			return c.json({ ok: true, answerId });
		},
	)
	.get(
		"/api/answer/status",
		zValidator("query", UserIdQuerySchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId } = c.req.valid("query");
			const statuses = await getAnswerStatuses(c.env.CACHE, c.env.DB, userId);
			return c.json({ statuses });
		},
	)
	.get(
		"/api/answer/history",
		zValidator("query", UserIdQuerySchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId } = c.req.valid("query");
			const answers = await getUserAnswerHistory(c.env.DB, userId);
			return c.json({ answers });
		},
	)
	.post(
		"/api/timer/sync",
		postBodyLimit,
		zValidator("json", SyncRequestSchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId, records } = c.req.valid("json");
			const merged = await syncAttempts(c.env.DB, userId, records);
			return c.json({ records: merged.records, syncedAt: Date.now() });
		},
	)
	.get(
		"/api/timer/load",
		zValidator("query", UserIdQuerySchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId } = c.req.valid("query");
			await upsertUser(c.env.DB, userId);
			const data = await loadUserAttempts(c.env.DB, userId);
			return c.json({ records: data.records, syncedAt: Date.now() });
		},
	)
	.delete(
		"/api/timer/clear",
		zValidator("query", ClearQuerySchema, (r, c) => {
			if (!r.success) return invalid(c, r.error.issues);
		}),
		async (c) => {
			const { userId, questionId } = c.req.valid("query");
			await clearUserQuestionRecords(c.env.DB, userId, questionId);
			return c.json({ success: true });
		},
	)
	.get("/api/markdown", (c) => markdownRoute(c, ""))
	.get("/api/markdown/*", (c) => markdownRoute(c, c.req.path.slice("/api/markdown/".length)));

async function markdownRoute(c: Context, path: string): Promise<Response> {
	const { status, body } = await renderMarkdown(path);
	if (status === 200) {
		return c.body(body, 200, {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		});
	}
	return c.body(body, status as 404);
}

export type ApiType = typeof api;
export default api;
