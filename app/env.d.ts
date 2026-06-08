declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		CACHE: KVNamespace;
	}
}
