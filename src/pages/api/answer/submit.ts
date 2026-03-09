import type { APIContext } from "astro";
import { AnswerSubmitSchema } from "../../../types/answer";
import { insertAnswer } from "../../../utils/d1AnswerRepository";
import { answerCacheKey, getRedisFromEnv } from "../../../utils/redis";

export const prerender = false;

export async function POST(context: APIContext) {
	try {
		const { env } = await import("cloudflare:workers");
		const db = env.DB;

		const body = await context.request.json();
		const parsed = AnswerSubmitSchema.safeParse(body);

		if (!parsed.success) {
			return new Response(
				JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { userId, questionId, selectedLabel, isCorrect, duration, timestamp } = parsed.data;

		const answerId = await insertAnswer(
			db,
			userId,
			questionId,
			selectedLabel,
			isCorrect,
			duration ?? null,
			timestamp,
		);

		// Redis キャッシュ更新（write-through、失敗しても問題ない）
		try {
			const redis = await getRedisFromEnv();
			if (redis) {
				await redis.set(
					answerCacheKey(userId, questionId),
					JSON.stringify({ label: selectedLabel, isCorrect }),
					{ ex: 86400 * 30 }, // 30日
				);
			}
		} catch {
			// Redis 失敗は無視（D1が信頼源）
		}

		return new Response(JSON.stringify({ ok: true, answerId }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Answer submit error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
