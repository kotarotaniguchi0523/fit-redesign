import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createApp } from "honox/server";
import { schema } from "./server/schema";

// セキュリティヘッダー（public/_headers と同一内容）。
// Cloudflare の _headers は静的アセット応答にしか適用されず、Worker が生成する SSR HTML
// には載らない。HTML 応答にも CSP/HSTS 等を付与するため Worker 側で明示設定する。
// （静的アセットは引き続き public/_headers が担当する。両者を同期させること。）
const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy":
		"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

type Env = { Bindings: Cloudflare.Env };

const app = new Hono<Env>();
// 末尾スラッシュ付き URL（/path/ → /path）を 301 正規化（honox/Workers のファイルルートは
// 末尾スラッシュを別パス扱いで 404 にするため。"/" は対象外）。
app.use(trimTrailingSlash());
app.use(async (c, next) => {
	// db はリクエスト毎に生成（Workers の env.DB はリクエストスコープ）。全 Context で c.var.db を使う。
	c.set("db", drizzle(c.env.DB, { schema }));
	await next();
	// 既にルートが設定したヘッダーは上書きしない（例: 共有ページの Referrer-Policy: no-referrer）。
	// Response.redirect 等の immutable headers に備え、設定失敗は握り潰す。
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!c.res.headers.has(name)) {
			try {
				c.header(name, value);
			} catch {
				// immutable response headers — このレスポンスには付与できないのでスキップ
			}
		}
	}
});

// API は HonoX のファイルルートとして自動マウントされる。ここでは共通基盤のみ適用する。
export default createApp({ app });
