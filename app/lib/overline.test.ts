import { describe, expect, it } from "vitest";
import { overlineToHtml } from "./overline";

describe("overlineToHtml", () => {
	it("結合オーバーライン(U+0305)を span.ovl に変換する", () => {
		expect(overlineToHtml("C̅")).toBe('<span class="ovl">C</span>');
	});

	it("結合マクロン(U+0304)も変換する", () => {
		expect(overlineToHtml("Ā")).toBe('<span class="ovl">A</span>');
	});

	it("論理式の一部だけを変換し、他はそのまま", () => {
		expect(overlineToHtml("A∧B ∨ A∧C̅")).toBe('A∧B ∨ A∧<span class="ovl">C</span>');
	});

	it("複数のオーバーラインを個別に変換する", () => {
		expect(overlineToHtml("B̅ ∨ A̅")).toBe('<span class="ovl">B</span> ∨ <span class="ovl">A</span>');
	});

	it("HTML特殊文字をエスケープする（XSS防止）", () => {
		expect(overlineToHtml("X>>3 & Y<1")).toBe("X&gt;&gt;3 &amp; Y&lt;1");
	});

	it("オーバーラインなしの文字列はエスケープのみ", () => {
		expect(overlineToHtml("10110(2)")).toBe("10110(2)");
	});

	it("改行を保持する", () => {
		expect(overlineToHtml("a\nb")).toBe("a\nb");
	});

	it("空文字列", () => {
		expect(overlineToHtml("")).toBe("");
	});
});
