import type {} from "hono";
import type { UserIdentityVariables } from "./server/userIdentity";

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
			},
		): Response | Promise<Response>;
	}

	// server.ts の middleware が全リクエストで set する識別情報を全 Context に型付けする。
	// これで honox の createRoute ハンドラも `c.var.userId` を型安全に読める（as キャスト不要）。
	interface ContextVariableMap extends UserIdentityVariables {}
}
