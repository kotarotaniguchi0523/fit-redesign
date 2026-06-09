import { Hono } from "hono";
import { getAnswerStatuses, updateAnswerStatus } from "../server/answerCache";
import { getUserAnswerHistory, insertAnswer } from "../server/answerRepository";
import { AnswerSubmitSchema } from "../types/answer";
import { UserIdQuerySchema } from "../types/api";
import { type Env, postBodyLimit, validate } from "./_lib";

/**
 * 回答 API の sub-app。HonoX に `/answer` へマウントされ、hc RPC の型基盤 `AnswerApp` を提供する。
 * 旧 per-file ルート（answer/{submit,status,history}.ts）を chained Hono に統合し、クライアントは
 * `hc<AnswerApp>("/answer")` で型安全に呼ぶ（fetch 直書きを廃止）。zod スキーマは server 側に留まり、
 * クライアントは型のみ（`import type`）取り込む。
 */
const answer = new Hono<Env>()
	.post("/submit", postBodyLimit, validate("json", AnswerSubmitSchema), async (c) => {
		const { userId, questionId, selectedLabel, isCorrect, duration, timestamp } =
			c.req.valid("json");
		const answerId = await insertAnswer(c.env.DB, {
			userId,
			questionId,
			selectedLabel,
			isCorrect,
			duration: duration ?? null,
			timestamp,
		});
		try {
			await updateAnswerStatus(c.env.CACHE, userId);
		} catch {
			// KV 失敗は無視（D1 が信頼源）
		}
		return c.json({ ok: true, answerId });
	})
	.get("/status", validate("query", UserIdQuerySchema), async (c) => {
		const { userId } = c.req.valid("query");
		const statuses = await getAnswerStatuses(c.env.CACHE, c.env.DB, userId);
		return c.json({ statuses });
	})
	.get("/history", validate("query", UserIdQuerySchema), async (c) => {
		const { userId } = c.req.valid("query");
		const answers = await getUserAnswerHistory(c.env.DB, userId);
		return c.json({ answers });
	});

export type AnswerApp = typeof answer;
export default answer;
