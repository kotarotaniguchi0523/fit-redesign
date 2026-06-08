import { zValidator } from "@hono/zod-validator";
import { syncAttempts } from "../../features/timer/timerRepository";
import { SyncRequestSchema } from "../../features/timer/types";
import { apiRoute, invalid, postBodyLimit } from "../_lib";

export const POST = apiRoute(
	postBodyLimit,
	zValidator("json", SyncRequestSchema, (r, c) => {
		if (!r.success) return invalid(c, r.error.issues);
	}),
	async (c) => {
		const { userId, records } = c.req.valid("json");
		const merged = await syncAttempts(c.env.DB, userId, records);
		return c.json({ records: merged.records, syncedAt: Date.now() });
	},
);
