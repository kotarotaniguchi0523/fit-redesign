import { describe, expect, it } from "vitest";
import { readEmbeddedManifest, type UnitManifestEntry } from "./progressClient";

/**
 * ページに埋め込んだマニフェストJSON（`[data-manifest]` 要素の textContent）を
 * 読み取る純粋関数の古典派ユニットテスト。
 * jsdom で root 要素を組み立て、入力（DOM の状態）→ 出力（パース結果 or `[]`）を
 * AAA で検証する。実装の分岐（要素無し／空文字／不正 JSON／非配列 JSON）に厳密に合わせ、
 * 「壊れた埋め込みでも throw せず空配列で劣化する」振る舞いを pin する。
 */

const entry: UnitManifestEntry = {
	id: "base-conversion",
	name: "基数変換",
	description: "10進・2進・16進の相互変換",
	primaryYear: 2013,
	questionIds: ["q-2013-1", "q-2013-2"],
};

/** `[data-manifest]` を子に持つ root を組み立てる（querySelector は子孫を探す） */
const buildRoot = (
	manifestText: string | null,
): { querySelector: (selectors: string) => Element | null } => {
	const root = document.createElement("div");
	const child = document.createElement("div");
	if (manifestText !== null) {
		child.setAttribute("data-manifest", "");
		child.textContent = manifestText;
	}
	root.append(child);
	return root;
};

describe("readEmbeddedManifest", () => {
	it("正常な JSON 配列をそのままパースして返す", () => {
		// Arrange
		const root = buildRoot(JSON.stringify([entry]));

		// Act
		const result = readEmbeddedManifest(root);

		// Assert
		expect(result).toEqual([entry]);
	});

	it("data-manifest 要素が無ければ空配列", () => {
		// Arrange: 子に data-manifest を付けない
		const root = buildRoot(null);

		// Act
		const result = readEmbeddedManifest(root);

		// Assert
		expect(result).toEqual([]);
	});

	it("textContent が空なら空配列", () => {
		// Arrange
		const root = buildRoot("");

		// Act
		const result = readEmbeddedManifest(root);

		// Assert
		expect(result).toEqual([]);
	});

	it("壊れた JSON でも throw せず空配列で劣化する", () => {
		// Arrange
		const root = buildRoot("{not valid json");

		// Act
		const result = readEmbeddedManifest(root);

		// Assert
		expect(result).toEqual([]);
	});

	it("配列でない JSON（オブジェクト）は空配列に正規化する", () => {
		// Arrange
		const root = buildRoot(JSON.stringify({ id: "x" }));

		// Act
		const result = readEmbeddedManifest(root);

		// Assert
		expect(result).toEqual([]);
	});
});
