import type { APIContext } from "astro";
import { z } from "zod";
import { syncAttempts } from "../../../utils/d1TimerRepository";

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

export async function POST(context: APIContext) {
	try {
		const { env } = await import("cloudflare:workers");
		const db = env.DB;

		const body = await context.request.json();
		const parsed = SyncRequestSchema.safeParse(body);

		if (!parsed.success) {
			return new Response(
				JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { userId, records } = parsed.data;
		const merged = await syncAttempts(db, userId, records);

		return new Response(
			JSON.stringify({ records: merged.records, syncedAt: Date.now() }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Timer sync error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
