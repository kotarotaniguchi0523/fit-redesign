import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://fit-redesign.pages.dev",
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	integrations: [sitemap()],
	experimental: {
		advancedRouting: true,
	},
	image: {
		service: { entrypoint: "astro/assets/services/noop" },
	},
	vite: {
		plugins: [tailwindcss()],
		// hono/jsx/dom クライアントコンポーネント(.tsx)を esbuild が正しく変換するための設定
		esbuild: {
			jsx: "automatic",
			jsxImportSource: "hono/jsx/dom",
		},
		ssr: {
			external: ["sharp"],
		},
	},
});
