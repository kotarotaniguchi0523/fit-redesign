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
	image: {
		service: { entrypoint: "astro/assets/services/noop" },
	},
	vite: {
		plugins: [tailwindcss()],
		ssr: {
			external: ["sharp"],
		},
	},
});
