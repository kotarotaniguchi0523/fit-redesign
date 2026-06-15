import type {} from "hono";
import type { QuestionGradedDetail } from "./features/srs/srs";
import type { Db } from "./server/schema";
import type { UserIdentityVariables } from "./server/userIdentity";

// 採点イベント（constants.ts の QUESTION_GRADED_EVENT="question-graded"）を DOM のイベントマップへ
// 宣言マージする。これで addEventListener/dispatch の event が CustomEvent<QuestionGradedDetail> に
// 型付き解決され、購読側（srs-recorder / $LapStopwatch / $DailySession）の as キャストが不要になる。
declare global {
	interface DocumentEventMap {
		"question-graded": CustomEvent<QuestionGradedDetail>;
	}
}

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
			},
		): Response | Promise<Response>;
	}

	// server.ts の middleware が全リクエストで set する識別情報を全 Context に型付けする。
	// これで honox の createRoute ハンドラも `c.var.userId` を型安全に読める（as キャスト不要）。
	// db も同 middleware で set するため全 Context で `c.var.db` が型付く。
	interface ContextVariableMap extends UserIdentityVariables {
		db: Db;
	}
}
