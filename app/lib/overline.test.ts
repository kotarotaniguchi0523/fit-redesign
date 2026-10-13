import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { overlineToHtml } from "./overline.ts";

describe("overlineToHtml", () => {
	it("結合オーバーライン(U+0305)を span.ovl に変換する", () => {
		assert.equal(overlineToHtml("C̅"), '<span class="ovl">C</span>');
	});

	it("結合マクロン(U+0304)も変換する", () => {
		assert.equal(overlineToHtml("Ā"), '<span class="ovl">A</span>');
	});

	it("論理式の一部だけを変換し、他はそのまま", () => {
		assert.equal(overlineToHtml("A∧B ∨ A∧C̅"), 'A∧B ∨ A∧<span class="ovl">C</span>');
	});

	it("複数のオーバーラインを個別に変換する", () => {
		assert.equal(
			overlineToHtml("B̅ ∨ A̅"),
			'<span class="ovl">B</span> ∨ <span class="ovl">A</span>',
		);
	});

	it("HTML特殊文字をエスケープする（XSS防止）", () => {
		assert.equal(overlineToHtml("X>>3 & Y<1"), "X&gt;&gt;3 &amp; Y&lt;1");
	});

	it("オーバーラインなしの文字列はエスケープのみ", () => {
		assert.equal(overlineToHtml("10110(2)"), "10110(2)");
	});

	it("改行を保持する", () => {
		assert.equal(overlineToHtml("a\nb"), "a\nb");
	});

	it("空文字列", () => {
		assert.equal(overlineToHtml(""), "");
	});
});
