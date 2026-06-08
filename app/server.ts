import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createApp } from "honox/server";

// セキュリティヘッダー（public/_headers と同一内容）。
// Cloudflare の _headers は静的アセット応答にしか適用されず、Worker が生成する SSR HTML
// には載らない。HTML 応答にも CSP/HSTS 等を付与するため Worker 側で明示設定する。
// （静的アセットは引き続き public/_headers が担当する。）
const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy":
		"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

// 末尾スラッシュ付き URL（以前は /dashboard/ 形式の URL を出力していた）を正規化。
// honox/Workers のファイルルートは末尾スラッシュを別パス扱いで 404 にするため、
// /path/ → /path へ 301 して既存ブックマーク・内部リンクを救済する（"/" は対象外）。
const app = new Hono();
app.use(trimTrailingSlash());
app.use(async (c, next) => {
	await next();
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		c.header(name, value);
	}
});

// API は HonoX のファイルルート app/routes/api.ts（Hono インスタンスの default export）として
// /* に自動マウントされる。ここでは composition root の共通ミドルウェアのみ適用する。
export default createApp({ app });
