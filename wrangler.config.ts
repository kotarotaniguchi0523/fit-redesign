import { defineWranglerConfig } from "wrangler/experimental-config";

/**
 * Wrangler ビルド向けの補助設定。
 * アセットの配信元ディレクトリは CF CLI 側（cloudflare.config.ts の worker.assets）で
 * 有効にし、ここではビルド成果物のディレクトリだけを示す。
 */
export default defineWranglerConfig({
	assetsDirectory: "public",
});
