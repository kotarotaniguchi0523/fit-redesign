import { Hono } from "hono";
import { getAnswerStatuses, updateAnswerStatus } from "../server/answerCache";
import { getUserAnswerHistory, insertAnswer } from "../server/answerRepository";
import { type Env, postBodyLimit, validate } from "./_lib";
import { AnswerSubmitSchema } from "./_schemas";

/**
 * 回答 API の sub-app。HonoX に `/answer` へマウントされ、hc RPC の型基盤 `AnswerApp` を提供する。
 * 旧 per-file ルート（answer/{submit,status,history}.ts）を chained Hono に統合し、クライアントは
 * `hc<AnswerApp>("/answer")` で型安全に呼ぶ（fetch 直書きを廃止）。zod スキーマは server 側に留まり、
 * クライアントは型のみ（`import type`）取り込む。
 */
const answer = new Hono<Env>()
	.post("/submit", postBodyLimit, validate("json", AnswerSubmitSchema), async (c) => {
		const userId = c.var.userId;
		const { questionId, selectedLabel, isCorrect, duration } = c.req.valid("json");
		// 未登録 question は記録されず answerId は null（insert-from-select が 0 行）。
		const answerId = await insertAnswer(c.var.db, {
			userId,
			questionId,
			selectedLabel,
			isCorrect,
			duration: duration ?? null,
		});
		try {
			await updateAnswerStatus(c.env.CACHE, userId);
		} catch {
			// KV 失敗は無視（D1 が信頼源）
		}
		return c.json({ ok: true, answerId });
	})
	.get("/status", async (c) => {
		const userId = c.var.userId;
		const statuses = await getAnswerStatuses(c.env.CACHE, c.var.db, userId);
		return c.json({ statuses });
	})
	.get("/history", async (c) => {
		const userId = c.var.userId;
		const answers = await getUserAnswerHistory(c.var.db, userId);
		return c.json({ answers });
	});

export type AnswerApp = typeof answer;
export default answer;
