import { sentry } from "@sentry/hono/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createApp } from "honox/server";
import {
	getSentryConnectSources,
	sanitizeSentryBreadcrumb,
	sanitizeSentryEvent,
	sanitizeSentryLog,
} from "./features/telemetry/sentry";

type Env = { Bindings: Cloudflare.Env & { SENTRY_DSN?: string } };

const app = new Hono<Env>();
// HonoX が後からマウントするルートも含め、最初にWorker用Sentry middlewareを適用する。
app.use(
	sentry(app, (env) => ({
		dsn: env.SENTRY_DSN,
		release: __SENTRY_RELEASE__ || undefined,
		sendDefaultPii: false,
		enableLogs: true,
		_flushInterval: 0,
		beforeSend: sanitizeSentryEvent,
		beforeBreadcrumb: sanitizeSentryBreadcrumb,
		beforeSendLog: sanitizeSentryLog,
	})),
);
// 末尾スラッシュ付き URL（/path/ → /path）を 301 正規化（honox/Workers のファイルルートは
// 末尾スラッシュを別パス扱いで 404 にするため。"/" は対象外）。
app.use(trimTrailingSlash());
// public/_headers は静的アセットだけが対象。WorkerのSSR/APIにはHono標準Middlewareで同等の
// セキュリティヘッダーを付与する。
app.use((c, next) =>
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
			connectSrc: [
				"'self'",
				...getSentryConnectSources(c.env.SENTRY_DSN, __SENTRY_BROWSER_DSN_ORIGIN__),
			],
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
	})(c, next),
);
app.use(async (c, next) => {
	// db はリクエスト毎に生成（Workers の env.DB はリクエストスコープ）。全 Context で c.var.db を使う。
	c.set("db", drizzle(c.env.DB));
	await next();
});

// API は HonoX のファイルルートとして自動マウントされる。ここでは共通基盤のみ適用する。
export default createApp({ app });
