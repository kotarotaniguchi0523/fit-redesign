import type { APIContext } from "astro";
import { z } from "zod";
import { clearUserQuestionRecords } from "../../../utils/d1TimerRepository";

export const prerender = false;

const ClearQuerySchema = z.object({
	userId: z.string().min(1),
	questionId: z.string().min(1),
});

export async function DELETE(context: APIContext) {
	try {
		const { env } = await import("cloudflare:workers");
		const db = env.DB;

		const url = new URL(context.request.url);
		const parsed = ClearQuerySchema.safeParse({
			userId: url.searchParams.get("userId"),
			questionId: url.searchParams.get("questionId"),
		});

		if (!parsed.success) {
			return new Response(
				JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { userId, questionId } = parsed.data;
		await clearUserQuestionRecords(db, userId, questionId);

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Timer clear error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
