/** @jsxImportSource hono/jsx */
// biome-ignore-all lint/correctness/noNodejsModules: This Vitest suite exercises Node-based build tooling.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { defaultPlugin, toSSG } from "hono/ssg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createIndexableSitemapPlugin,
	createStaticSiteIntegrityPlugin,
} from "../scripts/static-site-integrity.mjs";
import notFoundPageRoute from "./routes/404";

const SITE_URL = "https://example.test";
const testRenderer = jsxRenderer(({ children, title, noindex }) => (
	<html lang="ja">
		<head>
			<title>{title}</title>
			{noindex ? <meta name="robots" content="noindex, follow" /> : null}
		</head>
		<body>{children}</body>
	</html>
));

let outputDir: string;

async function createOutputFixture({
	brokenLink = false,
	brokenFragment = false,
	brokenRedirect = false,
	missingAsset = false,
	incorrectGuideCanonical = false,
}: {
	brokenLink?: boolean;
	brokenFragment?: boolean;
	brokenRedirect?: boolean;
	missingAsset?: boolean;
	incorrectGuideCanonical?: boolean;
} = {}): Promise<string[]> {
	await mkdir(path.join(outputDir, "assets"), { recursive: true });
	let homeHref = "/guide/#details";
	if (brokenLink) {
		homeHref = "/does-not-exist";
	} else if (brokenFragment) {
		homeHref = "/guide#missing";
	}
	const imageSrc = missingAsset ? "/assets/missing.svg" : "/assets/logo.svg";
	const pages = new Map([
		[
			"index.html",
			`<!doctype html><html><head><link rel="canonical" href="${SITE_URL}/"><link rel="stylesheet" href="/assets/site.css"></head><body><main id="main-content"><a href="${homeHref}">Guide</a><img src="${imageSrc}"></main></body></html>`,
		],
		[
			"guide.html",
			`<!doctype html><html><head><link rel="canonical" href="${SITE_URL}${incorrectGuideCanonical ? "/" : "/guide"}"></head><body><main id="details">Details</main></body></html>`,
		],
		[
			"slide-only.html",
			`<!doctype html><html><head><link rel="canonical" href="${SITE_URL}/slide-only"></head><body>Slides</body></html>`,
		],
		[
			"quiz.html",
			'<!doctype html><html><head><meta name="robots" content="noindex, follow"></head><body>Quiz</body></html>',
		],
		[
			"404.html",
			`<!doctype html><html><head><meta name="robots" content="noindex, follow"></head><body><main id="main-content"><a href="/">Home</a><a href="/slide-only">Slides</a></main></body></html>`,
		],
	]);
	for (const [relativePath, html] of pages) {
		await writeFile(path.join(outputDir, relativePath), html);
	}
	await writeFile(
		path.join(outputDir, "assets/site.css"),
		'main { background: url("/assets/logo.svg"); }',
	);
	await writeFile(
		path.join(outputDir, "assets/logo.svg"),
		'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
	);
	await writeFile(
		path.join(outputDir, "_redirects"),
		`/legacy ${brokenRedirect ? "/missing" : "/guide"} 301\n`,
	);
	return [...pages.keys()].map((relativePath) => path.join(outputDir, relativePath));
}

async function runIntegrity(files: string[], routes: Hono["routes"] = []): Promise<void> {
	const result = { success: true, files };
	const fsModule = { writeFile, mkdir };
	const options = { dir: outputDir };
	const sitemap = createIndexableSitemapPlugin(SITE_URL);
	await sitemap.afterGenerateHook?.(result, fsModule, options);
	const integrity = createStaticSiteIntegrityPlugin({ baseUrl: SITE_URL, routes });
	await integrity.afterGenerateHook?.(result, fsModule, options);
}

beforeEach(async () => {
	outputDir = await mkdtemp(path.join(os.tmpdir(), "fit-static-integrity-"));
});

afterEach(async () => {
	await rm(outputDir, { recursive: true, force: true });
});

describe("Static site integrity", () => {
	// @lat: [[testing#Static site integrity#SSG generates a noindex 404 document]]
	it("SSG generates 404.html from the shared Not Found page with noindex", async () => {
		const app = new Hono();
		app.use("*", testRenderer);
		app.get("/404", ...notFoundPageRoute);
		const result = await toSSG(
			app,
			{ writeFile, mkdir },
			{ dir: outputDir, plugins: [defaultPlugin()] },
		);

		expect(result.success).toBe(true);
		expect(result.files.map((file) => path.basename(file))).toContain("404.html");
		const html = await readFile(path.join(outputDir, "404.html"), "utf8");
		expect(html).toContain("ページが見つかりません");
		expect(html).toContain('name="robots" content="noindex, follow"');
	});

	// @lat: [[testing#Static site integrity#Indexable canonical pages are listed in sitemap]]
	it("sitemap contains only generated canonical indexable pages", async () => {
		const files = await createOutputFixture();

		await runIntegrity(files);

		const sitemap = await readFile(path.join(outputDir, "sitemap.xml"), "utf8");
		expect(sitemap).toContain(`<loc>${SITE_URL}/</loc>`);
		expect(sitemap).toContain(`<loc>${SITE_URL}/guide</loc>`);
		expect(sitemap).not.toContain("404");
		expect(sitemap).not.toContain("quiz");
	});

	// @lat: [[testing#Static site integrity#Valid internal links and assets pass]]
	it("accepts working internal links, fragments, assets, and redirect targets", async () => {
		const files = await createOutputFixture();

		await expect(runIntegrity(files)).resolves.toBeUndefined();
	});

	// @lat: [[testing#Static site integrity#Internal links can target parameterized Worker routes]]
	it("accepts links to parameterized Worker routes", async () => {
		const files = await createOutputFixture();
		const htmlPath = path.join(outputDir, "index.html");
		const html = await readFile(htmlPath, "utf8");
		await writeFile(
			htmlPath,
			html.replace(
				'<a href="/guide#details">Guide</a>',
				'<a href="/guide#details">Guide</a><a href="/records/entry-1">Records</a>',
			),
		);
		const app = new Hono();
		app.get("/records/:entryId", (c) => c.text(c.req.param("entryId")));

		await expect(runIntegrity(files, app.routes)).resolves.toBeUndefined();
	});

	// @lat: [[testing#Static site integrity#Broken internal links fail the build]]
	it("reports a broken internal link with its source and target", async () => {
		const files = await createOutputFixture({ brokenLink: true });

		await expect(runIntegrity(files)).rejects.toThrow(
			/index\.html has broken internal link "\/does-not-exist"/,
		);
	});

	// @lat: [[testing#Static site integrity#Broken internal links fail the build]]
	it("reports links to missing fragments on generated pages", async () => {
		const files = await createOutputFixture({ brokenFragment: true });

		await expect(runIntegrity(files)).rejects.toThrow(
			/index\.html has a broken fragment in link "\/guide#missing"/,
		);
	});

	// @lat: [[testing#Static site integrity#Broken internal links fail the build]]
	it("reports internal redirects whose target is not generated", async () => {
		const files = await createOutputFixture({ brokenRedirect: true });

		await expect(runIntegrity(files)).rejects.toThrow(
			/_redirects:1 redirects internally to "\/missing"/,
		);
	});

	// @lat: [[testing#Static site integrity#Missing static assets fail the build]]
	it("reports missing static asset references", async () => {
		const files = await createOutputFixture({ missingAsset: true });

		await expect(runIntegrity(files)).rejects.toThrow(
			/index\.html has broken internal asset reference "\/assets\/missing\.svg"/,
		);
	});

	// @lat: [[testing#Static site integrity#Canonical URLs match generated pages]]
	it("rejects canonical URLs that do not match their generated page", async () => {
		const files = await createOutputFixture({ incorrectGuideCanonical: true });

		await expect(runIntegrity(files)).rejects.toThrow(
			/guide\.html canonical URL .* does not match generated page/,
		);
	});

	// @lat: [[testing#Static site integrity#Duplicate output paths fail the build]]
	it("rejects duplicate SSG output paths", async () => {
		const files = await createOutputFixture();
		const indexHtml = files.find((file) => path.basename(file) === "index.html");
		if (!indexHtml) {
			throw new Error("Test fixture did not create index.html");
		}

		await expect(runIntegrity([...files, indexHtml])).rejects.toThrow(
			/Duplicate SSG output path "index\.html"/,
		);
	});
});
