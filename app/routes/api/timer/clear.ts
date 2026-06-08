import { zValidator } from "@hono/zod-validator";
import { clearUserQuestionRecords } from "../../../features/timer/timerRepository";
import { apiRoute, ClearQuerySchema, invalid } from "../_lib";

export const DELETE = apiRoute(
	zValidator("query", ClearQuerySchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
		const { userId, questionId } = c.req.valid("query");
		await clearUserQuestionRecords(c.env.DB, userId, questionId);
		return c.json({ success: true });
	},
);
