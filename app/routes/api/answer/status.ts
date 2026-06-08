import { zValidator } from "@hono/zod-validator";
import { getAnswerStatuses } from "../../../server/answerCache";
import { apiRoute, invalid, UserIdQuerySchema } from "../_lib";

export default apiRoute(
	zValidator("query", UserIdQuerySchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
		const { userId } = c.req.valid("query");
		const statuses = await getAnswerStatuses(c.env.CACHE, c.env.DB, userId);
		return c.json({ statuses });
	},
);
