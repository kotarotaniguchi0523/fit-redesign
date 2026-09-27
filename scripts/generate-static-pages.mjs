import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { robotsTxtPlugin } from "@hono/ssg-plugins-essential/robots-txt";
import { defaultExtensionMap, defaultPlugin, toSSG } from "hono/ssg";
import { createServer } from "vite";
import {
	createIndexableSitemapPlugin,
	createStaticSiteIntegrityPlugin,
} from "./static-site-integrity.mjs";

const staticRoutePaths = new Set([
	"/",
	"/404",
	"/guide",
	"/slide-only",
	"/markdown",
	"/llms.txt",
	"/llms-full.txt",
]);
const unitYearRoute = /^\/:[^/]+\/:[^/]+$/;
const examRoute = /^\/:[^/]+\/:[^/]+\/exam\/:[^/]+$/;
const questionRoute = /^\/:[^/]+\/:[^/]+\/exam\/:[^/]+\/question\/:[^/]+$/;

const server = await createServer({
	configFile: resolve("vite.config.ts"),
	server: { middlewareMode: true },
	appType: "custom",
	logLevel: "warn",
});

try {
	const [{ default: app }, { unitBasedTabs }, { SITE_URL }] = await Promise.all([
		server.ssrLoadModule("/app/server.ts"),
		server.ssrLoadModule("/app/data/units.ts"),
		server.ssrLoadModule("/app/data/site.ts"),
	]);
	const markdownAssetRewrites = ["/markdown /markdown.md 200"];
	for (const unit of unitBasedTabs) {
		for (const { year } of unit.examMapping) {
			const route = `/markdown/${unit.id}/${year}`;
			markdownAssetRewrites.push(`${route} ${route}.md 200`);
		}
	}
	const redirectsPath = resolve("dist/_redirects");
	let existingRedirects = "";
	try {
		existingRedirects = await readFile(resolve("public/_redirects"), "utf8");
	} catch (error) {
		if (error?.code !== "ENOENT") {
			throw error;
		}
	}
	await writeFile(
		redirectsPath,
		`${existingRedirects.trimEnd()}\n${markdownAssetRewrites.join("\n")}\n`,
	);
	const result = await toSSG(
		app,
		{
			writeFile,
			mkdir,
		},
		{
			dir: resolve("dist"),
			beforeRequestHook: (request) => {
				const { pathname } = new URL(request.url);
				const shouldGenerate =
					staticRoutePaths.has(pathname) ||
					unitYearRoute.test(pathname) ||
					examRoute.test(pathname) ||
					questionRoute.test(pathname) ||
					pathname === "/markdown/:unit/:year";
				if (!shouldGenerate) {
					return false;
				}
				const headers = new Headers(request.headers);
				headers.set("x-honox-ssg", "true");
				return new Request(request, { headers });
			},
			extensionMap: { "text/markdown": "md", ...defaultExtensionMap },
			plugins: [
				defaultPlugin(),
				createIndexableSitemapPlugin(SITE_URL),
				robotsTxtPlugin({
					rules: [
						...[
							"GPTBot",
							"ChatGPT-User",
							"ClaudeBot",
							"Anthropic-ai",
							"PerplexityBot",
							"Google-Extended",
							"Googlebot",
							"Bingbot",
						].map((userAgent) => ({ userAgent, allow: ["/"] })),
						{ userAgent: "*", allow: ["/"], disallow: ["/records", "/progress/"] },
					],
					sitemapUrl: `${SITE_URL}/sitemap.xml`,
					extraLines: ["# AI Search Engine Bots - Allowed"],
				}),
				createStaticSiteIntegrityPlugin({ baseUrl: SITE_URL, routes: app.routes }),
			],
		},
	);

	if (!result.success) {
		throw result.error;
	}

	console.info(`Generated ${result.files.length} SSG outputs in dist/`);
} finally {
	await server.close();
}
