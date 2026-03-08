import type { APIContext } from "astro";
import { z } from "zod";
import { loadUserAttempts, upsertUser } from "../../../utils/d1TimerRepository";

export const prerender = false;

const LoadQuerySchema = z.object({
	userId: z.string().min(1),
});

export async function GET(context: APIContext) {
	try {
		const { env } = await import("cloudflare:workers");
		const db = env.DB;

		const url = new URL(context.request.url);
		const parsed = LoadQuerySchema.safeParse({
			userId: url.searchParams.get("userId"),
		});

		if (!parsed.success) {
			return new Response(
				JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { userId } = parsed.data;
		await upsertUser(db, userId);
		const data = await loadUserAttempts(db, userId);

		return new Response(
			JSON.stringify({ records: data.records, syncedAt: Date.now() }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Timer load error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
