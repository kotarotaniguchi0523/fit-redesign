/// <reference types="astro/client" />

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		UPSTASH_REDIS_REST_URL: string;
		UPSTASH_REDIS_REST_TOKEN: string;
	}
}
