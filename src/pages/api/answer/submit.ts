import { insertAnswer } from "../../../server/answerRepository";
import { badRequest, json, route } from "../../../server/http";
import { answerCacheKey, getRedisFromEnv } from "../../../server/redis";
import { AnswerSubmitSchema } from "../../../types/answer";

export const prerender = false;

export const POST = route("Answer submit error:", async ({ context, db }) => {
	const body = await context.request.json();
	const parsed = AnswerSubmitSchema.safeParse(body);

	if (!parsed.success) {
		return badRequest(parsed.error.issues);
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

	return json({ ok: true, answerId });
});
