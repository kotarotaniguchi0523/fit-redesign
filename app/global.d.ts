import type {} from "hono";

// _renderer.tsx が受け取る props を c.render に型付けする（honox 規約）。
declare module "hono" {
	// biome-ignore lint/style/useShorthandFunctionType: hono への宣言マージには interface の呼び出しシグネチャが必須
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
