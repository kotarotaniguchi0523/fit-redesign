import type { APIContext } from "astro";
import { getLatestAnswers } from "../../../utils/d1AnswerRepository";

export const prerender = false;

export async function GET(context: APIContext) {
	try {
		const userId = context.url.searchParams.get("userId");
		if (!userId) {
			return new Response(
				JSON.stringify({ error: "userId is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { env } = await import("cloudflare:workers");
		const db = env.DB;

		// D1 から最新回答を取得
		const statuses = await getLatestAnswers(db, userId);

		return new Response(
			JSON.stringify({ statuses }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Answer status error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
