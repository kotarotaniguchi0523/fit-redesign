import type {} from "hono";

// _renderer.tsx が受け取る props を c.render に型付けする（honox 規約）。
declare module "hono" {
	interface ContextRenderer {
		(
			content: string | Promise<string>,
			props: {
				title: string;
				description?: string;
				jsonLd?: Record<string, unknown>;
				noindex?: boolean;
			},
		): Response | Promise<Response>;
	}
}
