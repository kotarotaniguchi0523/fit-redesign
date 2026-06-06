import { z } from "zod";
import { syncAttempts } from "../../../features/timer/timerRepository";
import { badRequest, json, route } from "../../../server/http";

export const prerender = false;

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

export const POST = route("Timer sync error:", async ({ context, db }) => {
	const body = await context.request.json();
	const parsed = SyncRequestSchema.safeParse(body);

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
	}

	const { userId, records } = parsed.data;
	const merged = await syncAttempts(db, userId, records);

	return json({ records: merged.records, syncedAt: Date.now() });
});
