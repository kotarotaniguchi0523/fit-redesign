import { zValidator } from "@hono/zod-validator";
import { loadUserAttempts } from "../../features/timer/timerRepository";
import { upsertUser } from "../../server/userRepository";
import { UserIdQuerySchema } from "../../types/api";
import { apiRoute, invalid } from "../_lib";

export default apiRoute(
	zValidator("query", UserIdQuerySchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
		const { userId } = c.req.valid("query");
		await upsertUser(c.env.DB, userId);
		const data = await loadUserAttempts(c.env.DB, userId);
		return c.json({ records: data.records, syncedAt: Date.now() });
	},
);
