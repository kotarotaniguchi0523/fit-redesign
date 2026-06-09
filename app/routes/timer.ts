import { Hono } from "hono";
import {
	clearUserQuestionRecords,
	loadUserAttempts,
	syncAttempts,
} from "../features/timer/timerRepository";
import { ClearQuerySchema, SyncRequestSchema } from "../features/timer/types";
import { upsertUser } from "../server/userRepository";
import { UserIdQuerySchema } from "../types/api";
import { type Env, postBodyLimit, validate } from "./_lib";

/**
 * タイマー同期 API の sub-app。HonoX に `/timer` へマウントされ、hc RPC の型基盤 `TimerApp` を
 * 提供する。旧 per-file ルート（timer/{sync,load,clear}.ts）を chained Hono に統合し、クライアントは
 * `hc<TimerApp>("/timer")` で型安全に呼ぶ。
 */
const timer = new Hono<Env>()
	.post("/sync", postBodyLimit, validate("json", SyncRequestSchema), async (c) => {
		const { userId, records } = c.req.valid("json");
		const merged = await syncAttempts(c.env.DB, userId, records);
		return c.json({ records: merged.records, syncedAt: Date.now() });
	})
	.get("/load", validate("query", UserIdQuerySchema), async (c) => {
		const { userId } = c.req.valid("query");
		await upsertUser(c.env.DB, userId);
		const data = await loadUserAttempts(c.env.DB, userId);
		return c.json({ records: data.records, syncedAt: Date.now() });
	})
	.delete("/clear", validate("query", ClearQuerySchema), async (c) => {
		const { userId, questionId } = c.req.valid("query");
		await clearUserQuestionRecords(c.env.DB, userId, questionId);
		return c.json({ success: true });
	});

export type TimerApp = typeof timer;
export default timer;
