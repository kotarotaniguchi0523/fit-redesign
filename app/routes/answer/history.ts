import { zValidator } from "@hono/zod-validator";
import { getUserAnswerHistory } from "../../server/answerRepository";
import { UserIdQuerySchema } from "../../types/api";
import { apiRoute, invalid } from "../_lib";

export default apiRoute(
	zValidator("query", UserIdQuerySchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
		const { userId } = c.req.valid("query");
		const answers = await getUserAnswerHistory(c.env.DB, userId);
		return c.json({ answers });
	},
);
