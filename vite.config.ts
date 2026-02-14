import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [{ enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm] }) }, react(), tailwindcss()],
	build: {
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				manualChunks: {
					ui: ["@heroui/react", "framer-motion"],
				},
			},
		},
	},
});
