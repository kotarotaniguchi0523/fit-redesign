/**
 * セレクタに一致する全要素に setup を適用する DOM マウントヘルパー。
 * 各 feature の init 関数（initStudyHome 等）の定型を 1 箇所に集約する。
 *
 * ライフサイクル契約: 本プロジェクトは SSG + フルページロード（View Transitions /
 * クライアントサイドナビゲーション不使用）のため、マウントした要素はページ寿命まで
 * DOM に残り続ける。よって setup が張る interval / document リスナの teardown は不要
 * （ページ遷移時にドキュメントごと破棄される）。脱 customElements で disconnectedCallback
 * を失った代償はこの前提により実害なし。将来 View Transitions 等を導入する場合は、
 * setup に teardown を返させ View Transitions 等で発火する仕組みが必要になる
 * （beads: fit-redesign-ukd 参照）。
 */
export function mountAll(selector: string, setup: (el: HTMLElement) => void): void {
	for (const el of document.querySelectorAll<HTMLElement>(selector)) {
		setup(el);
	}
}
