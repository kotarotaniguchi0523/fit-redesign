import { render } from "hono/jsx/dom";
import type { JSX } from "hono/jsx/jsx-runtime";
import { describe, expect, it } from "vitest";

/**
 * hono/jsx/dom ツールチェーンの smoke テスト。
 * tsconfig の jsxImportSource: "hono/jsx/dom" と Vite(esbuild) の JSX 変換、
 * および render() の DOM マウントが機能することを jsdom 上で確認する。
 * フック（useState 等）の非同期挙動の実証は poc-selfgrade（agent-browser）で行う。
 */

function Greeting({ name }: { name: string }): JSX.Element {
	return <p class="greeting">こんにちは、{name}さん</p>;
}

describe("hono/jsx/dom toolchain", () => {
	it("JSX コンポーネントを jsdom コンテナへ描画し、期待する DOM を生成する", () => {
		// Arrange
		const container = document.createElement("div");
		document.body.appendChild(container);

		// Act
		render(<Greeting name="太郎" />, container);

		// Assert
		const paragraph = container.querySelector("p.greeting");
		expect(paragraph?.textContent).toBe("こんにちは、太郎さん");
	});
});
