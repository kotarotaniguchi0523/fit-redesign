import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { sitemapPlugin } from "@hono/ssg-plugins-essential/sitemap";

const DEFAULT_OUTPUT_DIR = "./static";
const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

function isHtmlFile(filePath) {
	return filePath.toLowerCase().endsWith(".html");
}

function relativeOutputPath(filePath, outputDir) {
	return path.relative(outputDir, path.resolve(filePath)).split(path.sep).join("/");
}

function canonicalPathForFile(filePath, outputDir) {
	const relativePath = relativeOutputPath(filePath, outputDir);
	if (relativePath === "index.html") {
		return "/";
	}
	if (relativePath.endsWith("/index.html")) {
		return `/${relativePath.slice(0, -"index.html".length)}`;
	}
	if (relativePath.endsWith(".html")) {
		return `/${relativePath.slice(0, -".html".length)}`;
	}
	return `/${relativePath}`;
}

function pageUrlForFile(filePath, outputDir, baseUrl) {
	return new URL(canonicalPathForFile(filePath, outputDir), baseUrl).href;
}

function hasNoindex(document) {
	return [
		...document.querySelectorAll(
			'meta[name="robots"], meta[name="googlebot"], meta[name="bingbot"]',
		),
	].some((meta) => /(?:^|[,\s])noindex(?:$|[,\s])/i.test(meta.getAttribute("content") ?? ""));
}

function documentFor(filePath, outputDir, baseUrl, html) {
	return new JSDOM(html, {
		url: pageUrlForFile(filePath, outputDir, baseUrl),
		contentType: "text/html",
	});
}

/**
 * Use the official essential sitemap plugin for URL canonicalization, while
 * excluding pages whose rendered HTML tells crawlers not to index them.
 */
export function createIndexableSitemapPlugin(baseUrl) {
	const essentialSitemap = sitemapPlugin({ baseUrl, canonicalize: true });
	return {
		afterGenerateHook: async (result, fsModule, options) => {
			if (!result.success) {
				return;
			}

			const outputDir = path.resolve(options?.dir ?? DEFAULT_OUTPUT_DIR);
			const indexableFiles = [];
			for (const filePath of result.files.filter(isHtmlFile)) {
				const html = await readFile(filePath, "utf8");
				const dom = documentFor(filePath, outputDir, baseUrl, html);
				if (!hasNoindex(dom.window.document)) {
					indexableFiles.push(filePath);
				}
				dom.window.close();
			}

			await essentialSitemap.afterGenerateHook?.(
				{ ...result, files: indexableFiles },
				fsModule,
				options,
			);
		},
	};
}

async function listFiles(directory, parent = "") {
	const output = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const relative = path.posix.join(parent, entry.name);
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			output.push(...(await listFiles(absolute, relative)));
		} else if (entry.isFile()) {
			output.push(relative);
		}
	}
	return output;
}

function isInternalUrl(url, baseUrl) {
	return url.origin === new URL(baseUrl).origin;
}

function parseRedirects(contents) {
	return contents.split(/\r?\n/).flatMap((line, index) => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			return [];
		}
		const [source, target] = trimmed.split(/\s+/);
		return source ? [{ source, target, line: index + 1 }] : [];
	});
}

function matchRedirect(sourcePattern, pathname) {
	if (!sourcePattern.includes("*")) {
		return sourcePattern === pathname ? "" : null;
	}
	const [before, after] = sourcePattern.split("*", 2);
	if (!pathname.startsWith(before) || !pathname.endsWith(after ?? "")) {
		return null;
	}
	const end = after ? pathname.length - after.length : pathname.length;
	return pathname.slice(before.length, end);
}

function redirectTarget(pathname, redirects) {
	for (const redirect of redirects) {
		const splat = matchRedirect(redirect.source, pathname);
		if (splat !== null) {
			return redirect.target.replace(":splat", splat);
		}
	}
	return null;
}

function normalizePathname(pathname) {
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes("\\") || decoded.includes("\0")) {
		return null;
	}
	const normalized = path.posix.normalize(`/${decoded.replace(/^\/+/, "")}`);
	return normalized === "/.." || normalized.startsWith("/../") ? null : normalized;
}

function staticPathCandidates(pathname) {
	const normalized = normalizePathname(pathname);
	if (!normalized) {
		return [];
	}
	if (normalized === "/") {
		return ["index.html"];
	}
	const withoutTrailingSlash = normalized.replace(/\/+$/, "");
	const relative = withoutTrailingSlash.slice(1);
	const candidates = [relative];
	if (!path.posix.extname(relative)) {
		candidates.push(`${relative}.html`, `${relative}/index.html`);
	}
	return candidates;
}

function matchesRoutePath(routePath, pathname) {
	const routeSegments = routePath.split("/").filter(Boolean);
	const pathSegments = pathname.split("/").filter(Boolean);
	let pathIndex = 0;

	for (const routeSegment of routeSegments) {
		if (routeSegment === "*") {
			return true;
		}
		if (routeSegment.startsWith(":")) {
			const optional = routeSegment.endsWith("?");
			if (pathSegments[pathIndex] === undefined) {
				if (optional) {
					continue;
				}
				return false;
			}
			pathIndex += 1;
			continue;
		}
		if (routeSegment !== pathSegments[pathIndex]) {
			return false;
		}
		pathIndex += 1;
	}

	return pathIndex === pathSegments.length;
}

function matchesRoute(pathname, routes) {
	return routes.some(
		({ method, path: routePath }) =>
			(method === "GET" || method === "ALL" || method === "*") &&
			matchesRoutePath(routePath, pathname),
	);
}

function resolveInternalTarget(
	pathname,
	{ baseUrl, files, routes, redirects, allowWorkerRoute = true },
) {
	let current = pathname;
	const seen = new Set();
	for (let hop = 0; hop < 10; hop += 1) {
		if (seen.has(current)) {
			return { ok: false, reason: `redirect loop at ${current}` };
		}
		seen.add(current);
		const target = redirectTarget(current, redirects);
		if (target) {
			const targetUrl = new URL(target, baseUrl);
			if (!isInternalUrl(targetUrl, baseUrl)) {
				return { ok: true };
			}
			current = targetUrl.pathname;
			continue;
		}
		const candidates = staticPathCandidates(current);
		const outputFile = candidates.find((candidate) => files.has(candidate));
		if (outputFile) {
			return { ok: true, pathname: current, outputFile };
		}
		if (allowWorkerRoute && matchesRoute(current, routes)) {
			return { ok: true };
		}
		return { ok: false, reason: "no generated asset or GET/ALL Worker route matches" };
	}
	return { ok: false, reason: "redirect chain exceeds 10 internal rewrites" };
}

function extractCssUrls(css) {
	const urls = [];
	for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
		const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
		if (value) {
			urls.push(value);
		}
	}
	for (const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)) {
		if (match[1]) {
			urls.push(match[1]);
		}
	}
	return urls;
}

function parseSitemapUrls(xml) {
	const dom = new JSDOM(xml, { contentType: "application/xml" });
	try {
		if (dom.window.document.querySelector("parsererror")) {
			throw new Error("sitemap.xml is not valid XML");
		}
		if (dom.window.document.documentElement.localName !== "urlset") {
			throw new Error(
				"sitemap.xml must contain a urlset (sitemap index is unnecessary for this site size)",
			);
		}
		if (dom.window.document.documentElement.namespaceURI !== SITEMAP_NAMESPACE) {
			throw new Error("sitemap.xml has an unexpected namespace");
		}
		return [...dom.window.document.getElementsByTagNameNS(SITEMAP_NAMESPACE, "loc")].map((node) =>
			(node.textContent ?? "").trim(),
		);
	} finally {
		dom.window.close();
	}
}

function formatProblems(problems) {
	return `Static site integrity validation failed:\n${problems.map((problem) => `- ${problem}`).join("\n")}`;
}

export function createStaticSiteIntegrityPlugin({ baseUrl, routes = [] }) {
	return {
		afterGenerateHook: async (result, _fsModule, options) => {
			if (!result.success) {
				return;
			}

			const outputDir = path.resolve(options?.dir ?? DEFAULT_OUTPUT_DIR);
			const outputPaths = result.files.map((filePath) => path.resolve(filePath));
			const outputRelativePaths = outputPaths.map((filePath) =>
				relativeOutputPath(filePath, outputDir),
			);
			const problems = [];
			const outputCounts = new Map();
			for (const relativePath of outputRelativePaths) {
				outputCounts.set(relativePath, (outputCounts.get(relativePath) ?? 0) + 1);
			}
			for (const [relativePath, count] of outputCounts) {
				if (count > 1) {
					problems.push(`Duplicate SSG output path "${relativePath}" (${count} outputs)`);
				}
			}

			const required404 = "404.html";
			if (!outputRelativePaths.includes(required404)) {
				problems.push(`Required SSG output "${required404}" was not generated`);
			}

			const outputFiles = new Set(await listFiles(outputDir));
			const redirectsFile = path.join(outputDir, "_redirects");
			let rawRedirects = [];
			try {
				rawRedirects = parseRedirects(await readFile(redirectsFile, "utf8"));
			} catch (error) {
				if (error?.code !== "ENOENT") {
					throw error;
				}
			}
			const redirects = [];
			for (const redirect of rawRedirects) {
				if (!redirect.target) {
					problems.push(`dist/_redirects:${redirect.line} has no redirect target`);
					continue;
				}
				let target;
				try {
					target = new URL(redirect.target, baseUrl);
				} catch {
					problems.push(
						`dist/_redirects:${redirect.line} has invalid redirect target "${redirect.target}"`,
					);
					continue;
				}
				redirects.push(redirect);
				if (!isInternalUrl(target, baseUrl)) {
					continue;
				}
				const resolved = resolveInternalTarget(target.pathname, {
					baseUrl,
					files: outputFiles,
					routes,
					redirects,
				});
				if (!resolved.ok) {
					problems.push(
						`dist/_redirects:${redirect.line} redirects internally to "${target.pathname}": ${resolved.reason}`,
					);
				}
			}

			const generatedHtml = outputPaths.filter(isHtmlFile);
			const documentsByOutputPath = new Map();
			for (const filePath of generatedHtml) {
				const html = await readFile(filePath, "utf8");
				documentsByOutputPath.set(relativeOutputPath(filePath, outputDir), {
					filePath,
					dom: documentFor(filePath, outputDir, baseUrl, html),
				});
			}
			const expectedSitemapUrls = [];
			for (const [relativePath, { filePath, dom }] of documentsByOutputPath) {
				const { document } = dom.window;
				const noindex = hasNoindex(document);
				const canonicalLinks = [...document.querySelectorAll('link[rel~="canonical"]')];
				const expectedCanonical = pageUrlForFile(filePath, outputDir, baseUrl);
				if (relativePath === required404 && !noindex) {
					problems.push(`${relativePath} must contain a robots noindex directive`);
				}
				if (canonicalLinks.length > 1) {
					problems.push(
						`${relativePath} has ${canonicalLinks.length} canonical links; expected at most one`,
					);
				}
				const canonicalLink = canonicalLinks[0];
				if (canonicalLink) {
					let canonical;
					try {
						canonical = new URL(canonicalLink.getAttribute("href") ?? "", expectedCanonical).href;
					} catch {
						problems.push(`${relativePath} has an invalid canonical URL`);
					}
					if (canonical && canonical !== expectedCanonical) {
						problems.push(
							`${relativePath} canonical URL "${canonical}" does not match generated page "${expectedCanonical}"`,
						);
					}
				} else if (!noindex) {
					problems.push(`${relativePath} is indexable but has no canonical link`);
				}
				if (!noindex && canonicalLink) {
					expectedSitemapUrls.push(expectedCanonical);
				}

				const checkInternalLink = (rawUrl, elementDescription, requireStaticOutput = false) => {
					if (!rawUrl) {
						return;
					}
					let url;
					try {
						url = new URL(rawUrl, expectedCanonical);
					} catch {
						problems.push(`${relativePath} has invalid ${elementDescription} URL "${rawUrl}"`);
						return;
					}
					if (!isInternalUrl(url, baseUrl)) {
						return;
					}
					const resolved = resolveInternalTarget(url.pathname, {
						baseUrl,
						files: outputFiles,
						routes,
						redirects,
						allowWorkerRoute: !requireStaticOutput,
					});
					if (!resolved.ok) {
						problems.push(
							`${relativePath} has broken internal ${elementDescription} "${rawUrl}" (${resolved.reason})`,
						);
					} else if (url.hash && resolved.outputFile && isHtmlFile(resolved.outputFile)) {
						const targetDom = documentsByOutputPath.get(resolved.outputFile)?.dom.window.document;
						let fragment;
						try {
							fragment = decodeURIComponent(url.hash.slice(1));
						} catch {
							problems.push(
								`${relativePath} has an invalid fragment in ${elementDescription} "${rawUrl}"`,
							);
							return;
						}
						if (
							targetDom &&
							!targetDom.getElementById(fragment) &&
							targetDom.getElementsByName(fragment).length === 0
						) {
							problems.push(
								`${relativePath} has a broken fragment in ${elementDescription} "${rawUrl}"; target page "${resolved.outputFile}" has no "${fragment}" id`,
							);
						}
					}
				};

				for (const anchor of document.querySelectorAll("a[href], area[href]")) {
					checkInternalLink(anchor.getAttribute("href"), "link");
				}
				const assetElements = [
					[
						"script[src], img[src], source[src], video[src], audio[src], track[src], iframe[src]",
						"src",
					],
					["video[poster]", "poster"],
					['input[type="image"][src]', "src"],
					["object[data]", "data"],
					["embed[src]", "src"],
					["link[href], use[href], image[href]", "href"],
				];
				for (const [selector, attribute] of assetElements) {
					for (const element of document.querySelectorAll(selector)) {
						checkInternalLink(element.getAttribute(attribute), "asset reference", true);
					}
				}
				for (const form of document.querySelectorAll("form[action]")) {
					checkInternalLink(form.getAttribute("action"), "form action");
				}
				for (const element of document.querySelectorAll("img[srcset], source[srcset]")) {
					const srcset = element.getAttribute("srcset") ?? "";
					for (const candidate of srcset.split(",")) {
						const assetUrl = candidate.trim().split(/\s+/, 1)[0];
						if (assetUrl) {
							checkInternalLink(assetUrl, "asset reference", true);
						}
					}
				}
				for (const style of document.querySelectorAll("style, [style]")) {
					const css =
						style.tagName === "STYLE"
							? (style.textContent ?? "")
							: (style.getAttribute("style") ?? "");
					for (const rawUrl of extractCssUrls(css)) {
						checkInternalLink(rawUrl, "CSS asset reference", true);
					}
				}
			}

			for (const relativePath of outputFiles) {
				if (!relativePath.endsWith(".css")) {
					continue;
				}
				const css = await readFile(path.join(outputDir, relativePath), "utf8");
				const cssUrl = new URL(`/${relativePath}`, baseUrl);
				for (const rawUrl of extractCssUrls(css)) {
					let url;
					try {
						url = new URL(rawUrl, cssUrl);
					} catch {
						problems.push(`${relativePath} has invalid CSS asset URL "${rawUrl}"`);
						continue;
					}
					if (!isInternalUrl(url, baseUrl)) {
						continue;
					}
					const resolved = resolveInternalTarget(url.pathname, {
						baseUrl,
						files: outputFiles,
						routes,
						redirects,
						allowWorkerRoute: false,
					});
					if (!resolved.ok) {
						problems.push(`${relativePath} has missing CSS asset "${rawUrl}" (${resolved.reason})`);
					}
				}
			}

			const sitemapPath = path.join(outputDir, "sitemap.xml");
			try {
				const sitemapUrls = parseSitemapUrls(await readFile(sitemapPath, "utf8"));
				const actualSet = new Set(sitemapUrls);
				const expectedSet = new Set(expectedSitemapUrls);
				if (actualSet.size !== sitemapUrls.length) {
					problems.push("sitemap.xml contains duplicate canonical URLs");
				}
				for (const url of actualSet) {
					if (!expectedSet.has(url)) {
						problems.push(
							`sitemap.xml contains a URL without a matching indexable generated page: "${url}"`,
						);
					}
				}
				for (const url of expectedSet) {
					if (!actualSet.has(url)) {
						problems.push(`sitemap.xml is missing canonical URL for generated page: "${url}"`);
					}
				}
			} catch (error) {
				problems.push(
					`sitemap.xml could not be validated: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			for (const { dom } of documentsByOutputPath.values()) {
				dom.window.close();
			}
			if (problems.length > 0) {
				throw new Error(formatProblems(problems));
			}
		},
	};
}
