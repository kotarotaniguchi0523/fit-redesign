/**
 * セレクタに一致する全要素に setup を適用する DOM マウントヘルパー。
 * 各 feature の init 関数（initStudyHome 等）の定型を 1 箇所に集約する。
 */
export function mountAll(selector: string, setup: (el: HTMLElement) => void): void {
	for (const el of document.querySelectorAll<HTMLElement>(selector)) {
		setup(el);
	}
}
