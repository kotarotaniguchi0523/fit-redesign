import type { Database } from "remix/data-table";

/**
 * リクエストをまたいで共有する D1 データベースのレジストリ。
 *
 * Worker エントリ（`app/worker.ts`）がバインディングから構築して登録し、
 * ミドルウェアがリクエストコンテキストへ載せる。
 * `cloudflare:workers` への依存をルーターの import グラフから外すことで、
 * Node（`remix test` や SSR スモーク）でもルーターを読み込めるようにする。
 */
export type AppDatabase = Database<"d1">;

let database: AppDatabase | null = null;

export function setDatabase(next: AppDatabase | null): void {
	database = next;
}

export function getDatabase(): AppDatabase | null {
	return database;
}

/** Workers の RateLimit バインディング（構造的互換のため最小形で型付け）。 */
export interface RateLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

let rateLimiter: RateLimiter | null = null;

export function setRateLimiter(next: RateLimiter | null): void {
	rateLimiter = next;
}

export function getRateLimiter(): RateLimiter | null {
	return rateLimiter;
}
