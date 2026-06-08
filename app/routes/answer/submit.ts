import { zValidator } from "@hono/zod-validator";
import { updateAnswerStatus } from "../../server/answerCache";
import { insertAnswer } from "../../server/answerRepository";
import { AnswerSubmitSchema } from "../../types/answer";
import { apiRoute, invalid, postBodyLimit } from "../_lib";

export const POST = apiRoute(
	postBodyLimit,
	zValidator("json", AnswerSubmitSchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
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
	},
);
