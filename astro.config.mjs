import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
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
