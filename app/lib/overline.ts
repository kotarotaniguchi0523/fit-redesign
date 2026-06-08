/**
 * 問題文中の「結合オーバーライン(U+0305) / 結合マクロン(U+0304)」を、
 * フォント依存で□に化けないよう CSS の overline(span.ovl) に変換する。
 *
 * 例: "A∧C̅"（C の上に否定線）→ "A∧<span class=\"ovl\">C</span>"
 *
 * データ側の Unicode はそのまま保持し、描画時のみHTML化する。
 * `< > & "` は必ずエスケープしてから span を差し込むため、set:html で安全に使える。
 */

const COMBINING_OVERLINE = /(.)[̅̄]+/gu;

function escapeHtml(input: string): string {
	return input
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function overlineToHtml(input: string): string {
	// 先に全体をHTMLエスケープ（オーバーラインの基底文字は英字のみのため影響なし）、
	// その上で「基底文字＋結合オーバーライン」を span.ovl に置換する。
	return escapeHtml(input).replace(COMBINING_OVERLINE, '<span class="ovl">$1</span>');
}
