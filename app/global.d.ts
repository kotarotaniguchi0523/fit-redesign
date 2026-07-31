import type {} from "hono";
import type { Db } from "./server/schema";

// _renderer.tsx が受け取る props を c.render に型付けする（honox 規約）。
declare module "hono" {
	// hono への宣言マージには interface の呼び出しシグネチャが必須（type では不可）。
	interface ContextRenderer {
		(
			content: string | Promise<string>,
			props: {
				title: string;
				description?: string;
				jsonLd?: Record<string, unknown>;
				noindex?: boolean;
				// canonical override（path or 絶対URL、_renderer が SITE_URL に解決。未指定=c.req.path）
				canonical?: string;
				/** canonical/og:url を出力しない（共有 capability URL のトークンを meta に漏らさない）。 */
				noCanonical?: boolean;
			},
		): Response | Promise<Response>;
	}

	interface ContextVariableMap {
		db: Db;
	}
}
