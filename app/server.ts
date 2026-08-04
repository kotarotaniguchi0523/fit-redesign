import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createApp } from "honox/server";
import { schema } from "./server/schema";

type Env = { Bindings: Cloudflare.Env };

const app = new Hono<Env>();
// 末尾スラッシュ付き URL（/path/ → /path）を 301 正規化（honox/Workers のファイルルートは
// 末尾スラッシュを別パス扱いで 404 にするため。"/" は対象外）。
app.use(trimTrailingSlash());
// public/_headers は静的アセットだけが対象。WorkerのSSR/APIにはHono標準Middlewareで同等の
// セキュリティヘッダーを付与する。
app.use(
	secureHeaders({
		contentSecurityPolicy: {
			defaultSrc: ["'self'"],
			baseUri: ["'self'"],
			objectSrc: ["'none'"],
			frameAncestors: ["'none'"],
			scriptSrc: ["'self'", "'unsafe-inline'"],
			styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
			imgSrc: ["'self'", "data:"],
			fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
			connectSrc: ["'self'"],
		},
		referrerPolicy: "strict-origin-when-cross-origin",
		strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
		xContentTypeOptions: "nosniff",
		xFrameOptions: "DENY",
		permissionsPolicy: {
			geolocation: [],
			microphone: [],
			camera: [],
			payment: [],
			usb: [],
		},
	}),
);
app.use(async (c, next) => {
	// db はリクエスト毎に生成（Workers の env.DB はリクエストスコープ）。全 Context で c.var.db を使う。
	c.set("db", drizzle(c.env.DB, { schema }));
	await next();
});

// API は HonoX のファイルルートとして自動マウントされる。ここでは共通基盤のみ適用する。
export default createApp({ app });
