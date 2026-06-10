/** @jsxImportSource hono/jsx */

/**
 * 命令的 client バンドル（/app/client.ts）を全ページで読み込むための script タグ。
 *
 * honox の `<Script>`（honox/server）は出力を `HasIslands` でラップしており、ルートが
 * island を import している時のみ script を出力する。本アプリはホーム（進捗）・today
 * （デイリーセッション）・dashboard（chart.js）・guide（コピーボタン）など **island を
 * 持たないページでも命令的 client スクリプトを必要とする**ため、honox の Script では
 * これらのページで client バンドルが一切読まれない。
 *
 * 解決ロジック自体は honox の Script と同一（本番は vite manifest からハッシュ付き
 * 実体へ解決、dev は src をそのまま module script に）で、HasIslands gate のみ外す。
 */

import type { JSX } from "hono/jsx/jsx-runtime";

type ManifestEntry = { file: string };
type Manifest = Record<string, ManifestEntry>;

const MANIFEST_MODULES = import.meta.glob<{ default: Manifest }>("/dist/.vite/manifest.json", {
	eager: true,
});

const LEADING_SLASH_RE = /^\//;

function resolveManifest(): Manifest | undefined {
	const mod = Object.values(MANIFEST_MODULES).find((m) => m.default);
	return mod?.default;
}

/**
 * 本番ビルドの vite manifest から、エントリ src（例 "/app/client.ts"）のハッシュ付き
 * 実体パス（例 "/static/client-abc123.js"）を解決する純関数。manifest にエントリが
 * 無ければ undefined（= ClientScript が空を返す silent 失敗パス）。BASE_URL の末尾
 * スラッシュ有無を吸収する。env・glob に依存しないため単体テスト可能。
 */
export function resolveClientSrc(
	manifest: Manifest | undefined,
	src: string,
	baseUrl: string,
): string | undefined {
	const entry = manifest?.[src.replace(LEADING_SLASH_RE, "")];
	if (!entry) {
		return undefined;
	}
	const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	return `${prefix}${entry.file}`;
}

export function ClientScript({ src }: { src: string }): JSX.Element | null {
	if (!import.meta.env.PROD) {
		return <script type="module" src={src} />;
	}
	const resolved = resolveClientSrc(resolveManifest(), src, import.meta.env.BASE_URL || "/");
	if (!resolved) {
		return null;
	}
	return <script type="module" src={resolved} />;
}
