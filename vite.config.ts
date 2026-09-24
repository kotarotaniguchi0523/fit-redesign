import mdx from "@mdx-js/rollup";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import build from "@hono/vite-build/cloudflare-workers";
import adapter from "@hono/vite-dev-server/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import remarkGfm from "remark-gfm";
import { defineConfig, loadEnv, type Plugin } from "vite";

const clientInput = ["/app/client.ts", "/app/style.css"];
const honoxPlugins = honox({ devServer: { adapter }, client: { input: clientInput } });

function getSentryOrigin(dsn: string | undefined): string {
	if (!dsn) return "";

	try {
		return new URL(dsn).origin;
	} catch {
		return "";
	}
}

const clientPlugin: Plugin = {
	name: "honox-vite-client-oxc",
	apply: (_config, { command, mode }) => command === "build" && mode === "client",
	config: () => ({
		build: {
			rollupOptions: { input: clientInput },
			assetsDir: "static",
			manifest: true,
		},
		oxc: { jsx: { runtime: "automatic", importSource: "hono/jsx/dom" } },
	}),
};

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
	const sentryRelease = env.SENTRY_RELEASE;
	const uploadSourcemaps = Boolean(sentryAuthToken);

	if (uploadSourcemaps && (!env.SENTRY_ORG || !env.SENTRY_PROJECT || !sentryRelease)) {
		throw new Error("Sentry source-map upload requires SENTRY_ORG, SENTRY_PROJECT, and SENTRY_RELEASE.");
	}

	return {
		define: {
			__SENTRY_RELEASE__: JSON.stringify(sentryRelease ?? ""),
			__SENTRY_BROWSER_DSN_ORIGIN__: JSON.stringify(getSentryOrigin(env.VITE_SENTRY_DSN)),
		},
		// server 側 JSX は hono/jsx（islands は honox が hono/jsx/dom へ変換）。
		oxc: { jsx: { importSource: "hono/jsx" } },
		server: { allowedHosts: ["terminal.local"] },
		build: { sourcemap: uploadSourcemaps ? "hidden" : false },
		plugins: [
			// .mdx を hono/jsx の JSX コンポーネントへコンパイル（GFM テーブル対応）。honox より前に置く。
			mdx({ jsxImportSource: "hono/jsx", remarkPlugins: [remarkGfm] }),
			tailwindcss(),
			...honoxPlugins.slice(0, -1),
			clientPlugin,
			build(),
			...(uploadSourcemaps
				? [
						sentryVitePlugin({
							org: env.SENTRY_ORG,
							project: env.SENTRY_PROJECT,
							authToken: sentryAuthToken,
							telemetry: false,
							release: {
								name: sentryRelease,
								create: false,
								finalize: false,
								inject: false,
								setCommits: false,
							},
							sourcemaps: {
								assets: ["./dist/**/*.js", "./dist/**/*.js.map"],
								filesToDeleteAfterUpload: ["./dist/**/*.map"],
							},
						}),
					]
				: []),
		],
	};
});
