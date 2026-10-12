import { bindings, defineConfig } from 'cf/config'

import * as entrypoint from './app/worker.ts' with { type: 'cf-worker' }

/**
 * Cloudflare Workers プロジェクト設定（CF CLI の正準形式）。
 *
 * - 実行: `cf dev` / `cf build` / `cf deploy`
 * - 型生成: `cf workers types`
 * - D1 マイグレーション: `cf d1 migrations apply --dir db/migrations`
 *
 * 旧 wrangler.jsonc を置き換える。バインド名は app/env.d.ts と一致させる。
 */
export default defineConfig({
	worker: {
		name: 'fit-redesign',
		compatibilityDate: '2026-10-06',
		compatibilityFlags: ['nodejs_compat'],
		entrypoint,

		// すべてのリクエストを Worker（Remix SSR）へ通す。
		// 静的アセットは Worker から env.ASSETS へ委譲する。
		assets: {
			runWorkerFirst: true,
			notFoundHandling: 'none',
			htmlHandling: 'none',
		},

		env: {
			// 学習記録の同期に使う D1 データベース
			DB: bindings.d1({
				name: 'fit-timer-db',
				id: '57532062-e9cf-4a86-a89f-fc6fdb1e3ba5',
			}),
			// 同期 API のレート制限（60 回 / 60 秒）
			PROGRESS_RATE_LIMITER: bindings.rateLimit({
				namespace: '1001',
				simple: { limit: 60, period: 60 },
			}),
		},

		observability: {
			enabled: true,
			redactQueryString: true,
			logs: {
				enabled: true,
				invocationLogs: true,
				headSamplingRate: 0.1,
			},
			traces: {
				enabled: true,
				headSamplingRate: 0.05,
			},
		},
	},
})
