import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { JSDOM } from "jsdom";
import * as cssTree from "css-tree";
import { sitemapPlugin } from "@hono/ssg-plugins-essential/sitemap";

const DEFAULT_OUTPUT_DIR = "./static";
const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const ROBOTS_META_NAMES = new Set(["robots", "googlebot", "bingbot"]);
const STATIC_ASSET_REFERENCE_SELECTORS = [
	[
		"script[src], img[src], source[src], video[src], audio[src], track[src], iframe[src]",
		"src",
	],
	["video[poster]", "poster"],
	['input[type="image"][src]', "src"],
	["object[data]", "data"],
	["embed[src]", "src"],
	["link[href], use[href], image[href]", "href"],
	["use[xlink\\:href], image[xlink\\:href]", "xlink:href"],
];

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
		...document.querySelectorAll("meta[name]"),
	].some((meta) => {
		const name = meta.getAttribute("name")?.toLowerCase();
		const directives = (meta.getAttribute("content") ?? "").split(/[\s,;]+/);
		return ROBOTS_META_NAMES.has(name) && directives.some((directive) => directive.toLowerCase() === "noindex");
	});
}

function documentFor(filePath, outputDir, baseUrl, html) {
	return new JSDOM(html, {
		url: pageUrlForFile(filePath, outputDir, baseUrl),
		contentType: "text/html",
	});
}

async function loadPageDocument(filePath, outputDir, baseUrl, documentCache) {
	const absolutePath = path.resolve(filePath);
	const cached = documentCache.get(absolutePath);
	if (cached) {
		return cached;
	}
	const html = await readFile(absolutePath, "utf8");
	const page = { filePath: absolutePath, dom: documentFor(absolutePath, outputDir, baseUrl, html) };
	documentCache.set(absolutePath, page);
	return page;
}

/**
 * Use the official essential sitemap plugin for URL canonicalization, while
 * excluding pages whose rendered HTML tells crawlers not to index them.
 */
export function createIndexableSitemapPlugin(baseUrl, sharedDocumentCache) {
	const essentialSitemap = sitemapPlugin({ baseUrl, canonicalize: true });
	return {
		afterGenerateHook: async (result, fsModule, options) => {
			if (!result.success) {
				return;
			}

			const outputDir = path.resolve(options?.dir ?? DEFAULT_OUTPUT_DIR);
			const documentCache = sharedDocumentCache ?? new Map();
			const indexableFiles = [];
			for (const filePath of result.files.filter(isHtmlFile)) {
				const page = await loadPageDocument(filePath, outputDir, baseUrl, documentCache);
				if (!hasNoindex(page.dom.window.document)) {
					indexableFiles.push(filePath);
				}
				if (!sharedDocumentCache) {
					page.dom.window.close();
					documentCache.delete(path.resolve(filePath));
				}
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

function isInternalUrl(url, baseOrigin) {
	return url.origin === baseOrigin;
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

const REDIRECT_PATTERN_TOKEN = /(\*|:[A-Za-z]\w*)/g;
const REDIRECT_TARGET_TOKEN = /:([A-Za-z]\w*)/g;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileRedirectPattern(source, { splatPlaceholder = false } = {}) {
	let splatCount = 0;
	const placeholderNames = new Set();
	const patternParts = source.split(REDIRECT_PATTERN_TOKEN).map((part) => {
		if (part === "*") {
			splatCount += 1;
			return "(?<splat>.*)";
		}
		if (part.startsWith(":")) {
			const name = part.slice(1);
			if (splatPlaceholder && name === "splat") {
				splatCount += 1;
				return "(?<splat>.*)";
			}
			if (placeholderNames.has(name)) {
				throw new Error(`placeholder :${name} is repeated`);
			}
			placeholderNames.add(name);
			return `(?<${name}>[^/]+)`;
		}
		return escapeRegExp(part);
	});
	if (splatCount > 1) {
		throw new Error("Cloudflare _redirects supports one splat (*) per source path");
	}
	if (splatCount > 0 && placeholderNames.has("splat")) {
		throw new Error("placeholder :splat is reserved for a wildcard (*) capture");
	}
	const pattern = new RegExp(`^${patternParts.join("")}$`, "u");
	return { pattern, placeholderNames, splatCount };
}

function redirectTarget(pathname, redirects) {
	for (const redirect of redirects) {
		const match = redirect.pattern.exec(pathname);
		if (!match) {
			continue;
		}
		return redirect.target.replace(REDIRECT_TARGET_TOKEN, (token, name) =>
			Object.hasOwn(match.groups ?? {}, name) ? match.groups[name] : token,
		);
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

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "QUERY"]);

/**
 * Reuse Hono's route compiler for route syntax and parameter matching. HonoX
 * records layout middleware as ALL routes and its not-found page as GET /*;
 * neither is proof that a requested path has a successful endpoint.
 */
function createWorkerRouteMatcher(routes, allMethodRoutePaths = []) {
	const matcher = new Hono();
	const registeredRoutes = new Set();
	const allowedAllRoutes = new Set(allMethodRoutePaths);
	for (const { method: rawMethod, path: routePath } of routes) {
		const method = rawMethod.toUpperCase();
		if (routePath === "*" || routePath === "/*") {
			continue;
		}
		if (method === "ALL") {
			if (allowedAllRoutes.has(routePath)) {
				matcher.all(routePath, () => new Response(null, { status: 204 }));
			}
			continue;
		}
		if (!HTTP_METHODS.has(method)) {
			continue;
		}
		const key = `${method}\0${routePath}`;
		if (registeredRoutes.has(key)) {
			continue;
		}
		registeredRoutes.add(key);
		matcher.on(method, routePath, () => new Response(null, { status: 204 }));
	}

	const cache = new Map();
	return (method, pathname) => {
		const normalizedMethod = method.toUpperCase();
		const key = `${normalizedMethod}\0${pathname}`;
		if (!cache.has(key)) {
			const [matchedRoutes] = matcher.router.match(normalizedMethod, pathname);
			cache.set(key, matchedRoutes.length > 0);
		}
		return cache.get(key);
	};
}

function resolveInternalTarget(
	pathname,
	{ baseUrl, baseOrigin, files, routeMatcher, redirects, allowWorkerRoute = true, method = "GET" },
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
			let targetUrl;
			try {
				targetUrl = new URL(target, baseUrl);
			} catch {
				return { ok: false, reason: `redirect target is not a valid URL: ${target}` };
			}
			if (!isInternalUrl(targetUrl, baseOrigin)) {
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
		if (allowWorkerRoute && routeMatcher(method, current)) {
			return { ok: true };
		}
		return { ok: false, reason: `no generated asset or ${method} Worker route matches` };
	}
	return { ok: false, reason: "redirect chain exceeds 10 internal rewrites" };
}

function createInternalTargetResolver(context) {
	const cache = new Map();
	return (pathname, { allowWorkerRoute = true, method = "GET" } = {}) => {
		const key = `${method.toUpperCase()}\0${allowWorkerRoute ? "worker" : "static"}\0${pathname}`;
		if (!cache.has(key)) {
			cache.set(
				key,
				resolveInternalTarget(pathname, { ...context, allowWorkerRoute, method }),
			);
		}
		return cache.get(key);
	};
}

function publicPathsForFile(relativePath) {
	if (relativePath === "index.html") {
		return ["/"];
	}
	if (relativePath.endsWith("/index.html")) {
		const directoryPath = `/${relativePath.slice(0, -"index.html".length)}`;
		return [directoryPath, directoryPath.replace(/\/$/, "")];
	}
	if (relativePath.endsWith(".html")) {
		return [`/${relativePath}`, `/${relativePath.slice(0, -".html".length)}`];
	}
	return [`/${relativePath}`];
}

function extractCssUrls(css, context = "stylesheet") {
	const urls = [];
	const ast = cssTree.parse(css, { context });
	cssTree.walk(ast, (node) => {
		if (node.type === "Url") {
			urls.push(node.value);
			return;
		}
		if (node.type === "Atrule" && node.name.toLowerCase() === "import") {
			const importedFile = node.prelude?.children?.first;
			if (importedFile?.type === "String") {
				urls.push(importedFile.value);
			}
		}
	});
	return urls;
}

/** Parse srcset without splitting commas inside data: URLs. */
function extractSrcsetUrls(srcset) {
	const urls = [];
	let position = 0;
	while (position < srcset.length) {
		while (position < srcset.length && /[\t\n\f\r ,]/.test(srcset[position])) {
			position += 1;
		}
		if (position >= srcset.length) {
			break;
		}

		const start = position;
		while (position < srcset.length && !/[\t\n\f\r ]/.test(srcset[position])) {
			position += 1;
		}
		let candidate = srcset.slice(start, position);
		const trailingCommas = candidate.match(/,+$/)?.[0].length ?? 0;
		if (trailingCommas > 0) {
			candidate = candidate.slice(0, -trailingCommas);
			if (candidate) {
				urls.push(candidate);
			}
			continue;
		}
		if (candidate) {
			urls.push(candidate);
		}

		let parenthesisDepth = 0;
		while (position < srcset.length) {
			const character = srcset[position];
			if (character === "(") {
				parenthesisDepth += 1;
			} else if (character === ")" && parenthesisDepth > 0) {
				parenthesisDepth -= 1;
			} else if (character === "," && parenthesisDepth === 0) {
				position += 1;
				break;
			}
			position += 1;
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

export function createStaticSiteIntegrityPlugin({
	baseUrl,
	routes = [],
	allMethodRoutePaths = [],
	pageDocumentCache = new Map(),
}) {
	const baseOrigin = new URL(baseUrl).origin;
	const routeMatcher = createWorkerRouteMatcher(routes, allMethodRoutePaths);
	return {
		afterGenerateHook: async (result, _fsModule, options) => {
			if (!result.success) {
				return;
			}

			const outputDir = path.resolve(options?.dir ?? DEFAULT_OUTPUT_DIR);
			const outputEntries = result.files.map((filePath) => {
				const absolutePath = path.resolve(filePath);
				const relativePath = relativeOutputPath(absolutePath, outputDir);
				return { absolutePath, relativePath };
			});
			const isInsideOutputDir = (relativePath) =>
				relativePath !== ".." &&
				!relativePath.startsWith(`..${path.posix.sep}`) &&
				!path.isAbsolute(relativePath);
			const outputRelativePaths = outputEntries.map(({ relativePath }) => relativePath);
			const problems = [];
			for (const { relativePath } of outputEntries) {
				if (!isInsideOutputDir(relativePath)) {
					problems.push(`SSG reported output outside the configured directory: "${relativePath}"`);
				}
			}
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

			let outputFiles = new Set();
			try {
				outputFiles = new Set(await listFiles(outputDir));
			} catch (error) {
				problems.push(
					`Could not read SSG output directory "${outputDir}": ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			for (const { relativePath } of outputEntries) {
				if (isInsideOutputDir(relativePath) && !outputFiles.has(relativePath)) {
					problems.push(`SSG reported output "${relativePath}" but the file is missing`);
				}
			}
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
			const redirectTargets = [];
			for (const redirect of rawRedirects) {
				if (!redirect.target) {
					problems.push(`dist/_redirects:${redirect.line} has no redirect target`);
					continue;
				}
				let target;
				let sourcePattern;
				try {
					target = new URL(redirect.target, baseUrl);
					sourcePattern = compileRedirectPattern(redirect.source);
				} catch {
					problems.push(
						`dist/_redirects:${redirect.line} has invalid redirect pattern or target: "${redirect.source} ${redirect.target}"`,
					);
					continue;
				}
				const targetPlaceholders = [...redirect.target.matchAll(REDIRECT_TARGET_TOKEN)].map(
					([, name]) => name,
				);
				const unknownPlaceholders = targetPlaceholders.filter(
					(name) =>
						(name === "splat" && sourcePattern.splatCount === 0) ||
						(name !== "splat" && !sourcePattern.placeholderNames.has(name)),
				);
				if (unknownPlaceholders.length > 0) {
					problems.push(
						`dist/_redirects:${redirect.line} target references undefined placeholder(s): ${[...new Set(unknownPlaceholders)].map((name) => `:${name}`).join(", ")}`,
					);
					continue;
				}
				redirects.push({ ...redirect, pattern: sourcePattern.pattern });
				redirectTargets.push({
					redirect,
					target,
					targetPlaceholders,
					hasDynamicTarget: targetPlaceholders.length > 0,
				});
			}
			const resolveTarget = createInternalTargetResolver({
				baseUrl,
				baseOrigin,
				files: outputFiles,
				routeMatcher,
				redirects,
			});
			const generatedPublicPaths = [...outputFiles].flatMap(publicPathsForFile);
			for (const { redirect, target, targetPlaceholders, hasDynamicTarget } of redirectTargets) {
				if (!isInternalUrl(target, baseOrigin)) {
					continue;
				}
				const probeTargetPath = target.pathname.replace(REDIRECT_TARGET_TOKEN, (_token, name) =>
					name === "splat" ? "__ssg_probe__/child" : "__ssg_probe__",
				);
				const resolved = resolveTarget(probeTargetPath);
				if (!resolved.ok && !hasDynamicTarget) {
					problems.push(
						`dist/_redirects:${redirect.line} redirects internally to "${target.pathname}": ${resolved.reason}`,
					);
					continue;
				}
				if (resolved.ok || !hasDynamicTarget) {
					continue;
				}
				let targetPattern;
				try {
					targetPattern = compileRedirectPattern(target.pathname, {
						splatPlaceholder: targetPlaceholders.includes("splat"),
					}).pattern;
				} catch (error) {
					problems.push(
						`dist/_redirects:${redirect.line} has invalid dynamic target pattern "${target.pathname}": ${error instanceof Error ? error.message : String(error)}`,
					);
					continue;
				}
				const hasMatchingGeneratedPath = generatedPublicPaths.some(
					(publicPath) => targetPattern.test(publicPath) && resolveTarget(publicPath).ok,
				);
				if (!hasMatchingGeneratedPath) {
					problems.push(
						`dist/_redirects:${redirect.line} dynamic target pattern "${target.pathname}" does not match a generated page or Worker route`,
					);
				}
			}

			const generatedHtml = outputEntries
				.filter(({ absolutePath, relativePath }) => isInsideOutputDir(relativePath) && isHtmlFile(absolutePath) && outputFiles.has(relativePath))
				.map(({ absolutePath }) => absolutePath);
			const documentsByOutputPath = new Map();
			for (const filePath of generatedHtml) {
				const page = await loadPageDocument(filePath, outputDir, baseUrl, pageDocumentCache);
				documentsByOutputPath.set(relativeOutputPath(filePath, outputDir), {
					...page,
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
						canonical = new URL(canonicalLink.getAttribute("href") ?? "", document.baseURI).href;
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

				const checkInternalLink = (
					rawUrl,
					elementDescription,
					requireStaticOutput = false,
					method = "GET",
				) => {
					if (!rawUrl) {
						return;
					}
					let url;
					try {
						url = new URL(rawUrl, document.baseURI);
					} catch {
						problems.push(`${relativePath} has invalid ${elementDescription} URL "${rawUrl}"`);
						return;
					}
					if (!isInternalUrl(url, baseOrigin)) {
						return;
					}
					const resolved = resolveTarget(url.pathname, {
						allowWorkerRoute: !requireStaticOutput,
						method,
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
				for (const [selector, attribute] of STATIC_ASSET_REFERENCE_SELECTORS) {
					for (const element of document.querySelectorAll(selector)) {
						const rawUrl =
							attribute === "xlink:href"
								? (element.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
									element.getAttribute(attribute))
								: element.getAttribute(attribute);
						checkInternalLink(rawUrl, "asset reference", true);
					}
				}
				for (const form of document.querySelectorAll("form[action]")) {
					const method = (form.getAttribute("method") ?? "get").toUpperCase();
					if (method !== "DIALOG") {
						checkInternalLink(form.getAttribute("action"), "form action", false, method);
					}
				}
				for (const element of document.querySelectorAll("img[srcset], source[srcset]")) {
					for (const assetUrl of extractSrcsetUrls(element.getAttribute("srcset") ?? "")) {
						checkInternalLink(assetUrl, "asset reference", true);
					}
				}
				for (const style of document.querySelectorAll("style, [style]")) {
					const css =
						style.tagName === "STYLE"
							? (style.textContent ?? "")
							: (style.getAttribute("style") ?? "");
					const context = style.tagName === "STYLE" ? "stylesheet" : "declarationList";
					let cssUrls;
					try {
						cssUrls = extractCssUrls(css, context);
					} catch (error) {
						problems.push(
							`${relativePath} has invalid inline CSS: ${error instanceof Error ? error.message : String(error)}`,
						);
						continue;
					}
					for (const rawUrl of cssUrls) {
						checkInternalLink(rawUrl, "CSS asset reference", true);
					}
				}
			}

			for (const relativePath of outputFiles) {
				if (!relativePath.toLowerCase().endsWith(".css")) {
					continue;
				}
				const css = await readFile(path.join(outputDir, relativePath), "utf8");
				const cssUrl = new URL(`/${relativePath}`, baseUrl);
				let cssUrls;
				try {
					cssUrls = extractCssUrls(css);
				} catch (error) {
					problems.push(
						`${relativePath} has invalid CSS: ${error instanceof Error ? error.message : String(error)}`,
					);
					continue;
				}
				for (const rawUrl of cssUrls) {
					let url;
					try {
						url = new URL(rawUrl, cssUrl);
					} catch {
						problems.push(`${relativePath} has invalid CSS asset URL "${rawUrl}"`);
						continue;
					}
					if (!isInternalUrl(url, baseOrigin)) {
						continue;
					}
					const resolved = resolveTarget(url.pathname, { allowWorkerRoute: false });
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

			for (const { dom } of pageDocumentCache.values()) {
				dom.window.close();
			}
			pageDocumentCache.clear();
			if (problems.length > 0) {
				throw new Error(formatProblems(problems));
			}
		},
	};
}
