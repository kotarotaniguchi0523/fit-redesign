import type { UnitManifestEntry } from "../../utils/questionManifest";

export type { UnitManifestEntry };

/** ページに埋め込んだマニフェストJSONを読み取る */
export function readEmbeddedManifest(root: {
	querySelector: (selectors: string) => Element | null;
}): UnitManifestEntry[] {
	const el = root.querySelector("[data-manifest]");
	if (!el?.textContent) return [];
	try {
		const parsed = JSON.parse(el.textContent);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
