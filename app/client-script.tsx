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

type ManifestEntry = { file: string };
type Manifest = Record<string, ManifestEntry>;

const MANIFEST_MODULES = import.meta.glob<{ default: Manifest }>("/dist/.vite/manifest.json", {
	eager: true,
});

function resolveManifest(): Manifest | undefined {
	const mod = Object.values(MANIFEST_MODULES).find((m) => m.default);
	return mod?.default;
}

export function ClientScript({ src }: { src: string }) {
	if (!import.meta.env.PROD) {
		return <script type="module" src={src} />;
	}
	const entry = resolveManifest()?.[src.replace(/^\//, "")];
	if (!entry) return <></>;
	const base = import.meta.env.BASE_URL || "/";
	const prefix = base.endsWith("/") ? base : `${base}/`;
	return <script type="module" src={`${prefix}${entry.file}`} />;
}
