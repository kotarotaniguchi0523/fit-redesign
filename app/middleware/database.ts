import type { Middleware } from "remix/router";
import { createContextKey } from "remix/router";

import { type AppDatabase, getDatabase } from "../db/registry.ts";

/**
 * D1 データベースをリクエストコンテキストへ載せるミドルウェア。
 * Worker 以外（Node のテストや SSR スモーク）では `null` になる。
 */
export const databaseContext = createContextKey<AppDatabase | null>();

export function loadDatabase(): Middleware<{
	key: typeof databaseContext;
	value: AppDatabase | null;
	property: "db";
}> {
	return (context, next) => {
		context.set(databaseContext, getDatabase(), { property: "db" });
		return next();
	};
}
