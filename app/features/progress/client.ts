/**
 * 同期 API のブラウザークライアント。
 *
 * 旧実装は Hono RPC（`hono/client` の `hc<ProgressApp>`）で型付きクライアントを
 * 生成していたが、Remix ではその層が無いため素の `fetch` で同じ呼び出し面を提供する。
 * 呼び出し側（progressApi / challengeApi）のコードは変更せずに済む。
 */
const JSON_HEADERS = { "content-type": "application/json" } as const;

export const progressClient = {
	links: {
		$post: (): Promise<Response> => fetch("/progress/links", { method: "POST" }),
	},
	index: {
		$delete: (init: { header: Record<string, string> }): Promise<Response> =>
			fetch("/progress", { method: "DELETE", headers: init.header }),
	},
	sync: {
		$post: (init: { json: unknown; header: Record<string, string> }): Promise<Response> =>
			fetch("/progress/sync", {
				method: "POST",
				headers: { ...JSON_HEADERS, ...init.header },
				body: JSON.stringify(init.json),
			}),
	},
	challenges: {
		$post: (init: { json: unknown; header: Record<string, string> }): Promise<Response> =>
			fetch("/progress/challenges", {
				method: "POST",
				headers: { ...JSON_HEADERS, ...init.header },
				body: JSON.stringify(init.json),
			}),
	},
} as const;
