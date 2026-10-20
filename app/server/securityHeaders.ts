import { secureHeaders } from "hono/secure-headers";

// Keep the Web Analytics beacon allowlist in the same CSP used by production and route integration tests.
export const securityHeadersMiddleware = secureHeaders({
	contentSecurityPolicy: {
		defaultSrc: ["'self'"],
		baseUri: ["'self'"],
		objectSrc: ["'none'"],
		frameAncestors: ["'none'"],
		scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
		styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
		imgSrc: ["'self'", "data:"],
		fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
		connectSrc: ["'self'", "https://cloudflareinsights.com"],
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
});
