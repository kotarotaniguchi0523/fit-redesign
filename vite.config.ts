import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

/**
 * Cloudflare Vite プラグインは CF CLI の dev / build の必須要件。
 * Worker のエントリポイントとバインドは cloudflare.config.ts が所有する。
 */
export default defineConfig({
	plugins: [cloudflare()],
})
