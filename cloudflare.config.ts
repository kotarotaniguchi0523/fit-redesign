import { bindings, defineConfig } from "cf/config";

import * as entrypoint from "./app/worker.ts" with { type: "cf-worker" };

/**
 * Cloudflare Workers プロジェクト設定（CF CLI の正準形式）。
 *
 * - 実行: `cf dev` / `cf build` / `cf deploy`
 * - 型生成: `cf workers types`（`.cloudflare/types`）
 * - D1: `cf d1 migrations apply <database-id> --local --dir migrations`
 *
 * バインド名は `app/worker.ts` の利用箇所に一致させる。
 */
export default defineConfig({
	worker: {
		name: "fit-redesign",
		compatibilityDate: "2026-10-06",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint,

		// Remix が全ルートを SSR するため、全リクエストを Worker へ通す。
		// 静的アセットは Worker から env.ASSETS へ委譲する（app/worker.ts）。
		assets: {
			runWorkerFirst: true,
			notFoundHandling: "none",
			htmlHandling: "none",
		},

		env: {
			// Workers Assets（ビルド済みクライアントアセット・/public の配信）
			ASSETS: bindings.assets(),
			DB: bindings.d1({
				name: "fit-timer-db",
				id: "57532062-e9cf-4a86-a89f-fc6fdb1e3ba5",
			}),
			PROGRESS_RATE_LIMITER: bindings.rateLimit({
				namespace: "1001",
				simple: { limit: 60, period: 60 },
			}),
		},

		observability: {
			enabled: true,
			redactQueryString: true,
			logs: { enabled: true, invocationLogs: true, headSamplingRate: 0.1 },
			traces: { enabled: true, headSamplingRate: 0.05 },
		},
	},
});
