import { env } from "cloudflare:workers";
import { cf } from "@astrojs/cloudflare/hono";
import { astro } from "astro/hono";
import { Hono } from "hono";
import api from "./api";

/**
 * Astro experimental.advancedRouting のエントリポイント（src/app.ts = 既定の fetchFile）。
 * Hono アプリで Astro のリクエストパイプライン全体をマウントし、Hono ネイティブの
 * ルートを Astro の前段に差し込む。
 *
 * 合成: cf()（Cloudflare アダプタ必須）→ astro()（Astro 全パイプラインの all-in-one）。
 * astro() は astro/hono が提供する公式ハンドラで、trailingSlash/sessions/redirects/
 * middleware/actions/pages/i18n を manifest 設定に応じて内部実行する。未設定機能
 * （本プロジェクトでは i18n・session・actions）は内部で no-op になる＝i18n は実質不使用。
 *
 * ※ 公式 docs の granular 合成（cf→actions→middleware→pages→i18n を個別 app.use）は、
 *   @astrojs/cloudflare 13.6.0 + prerender で全ページが 500 化するため、本プロジェクトでは
 *   動作する all-in-one の astro() を採用する（experimental の既知の制約）。
 *
 * 自前ルートは Astro パイプライン（pages() は next を呼ばない）より前に登録する。
 *
 * ⚠️ experimental 機能（Astro 6.3+）。本番ビルドを通すため @astrojs/cloudflare 13.6.0 に
 *    ローカルパッチ（patches/@astrojs__cloudflare@13.6.0.patch）を適用している:
 *    1) fetch.js の lazy-init（循環依存 createGetEnv エラー回避）
 *       → 上流修正済み: withastro/astro@4bdd240。npm リリースされたら撤去可能。
 *    2) hono.js/fetch.js の prerender ガード（build 時は ExecutionContext / env が無いため
 *       executionCtx を安全取得し waitUntil をガード、env 不在時は CF セットアップを skip）。
 *       → 上流 main は未対応（ctx/env を無条件参照）の独自回避。撤去には上流の prerender 対応が必要。
 *          要 upstream issue（withastro/astro の cloudflare adapter）。
 */
const app = new Hono<{ Bindings: Cloudflare.Env }>();

// Hono ネイティブのヘルスチェック + RPC API（Astro パイプライン前段に登録）
app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/", api);

app.use(cf());
app.use(astro());

/**
 * advancedRouting では Astro が fetchFile の default を `fetch(request)` として
 * env なしで呼ぶため、Hono の c.env が空になる（c.env.DB / c.env.CACHE が undefined）。
 * `cloudflare:workers` のリクエストスコープ env を Hono の Bindings に注入し、
 * RPC ルート（server/api.ts）が c.env から D1 / KV を参照できるようにする。
 */
export default {
	fetch(request: Request, _env?: unknown, ctx?: ExecutionContext) {
		return app.fetch(request, env, ctx);
	},
};
