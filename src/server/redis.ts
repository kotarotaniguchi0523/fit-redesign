import { Redis } from "@upstash/redis/cloudflare";

export async function getRedisFromEnv(): Promise<Redis | null> {
	try {
		const { env } = await import("cloudflare:workers");
		const url = (env as unknown as Record<string, string>).UPSTASH_REDIS_REST_URL;
		const token = (env as unknown as Record<string, string>).UPSTASH_REDIS_REST_TOKEN;
		if (!url || !token) return null;
		return new Redis({ url, token });
	} catch {
		return null;
	}
}

// 回答済み状態のキャッシュキー
export function answerCacheKey(userId: string, questionId: string): string {
	return `answer:${userId}:${questionId}`;
}
