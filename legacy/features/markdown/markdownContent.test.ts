import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdownContent";

describe("renderMarkdown", () => {
	it("共有の問題Markdown整形を使い、図データを含めて返す", async () => {
		const result = await renderMarkdown("unit-logic/2013");

		expect(result.status).toBe(200);
		expect(result.body).toContain("### 問題 2");
		expect(result.body).toContain("#### 解答");
		expect(result.body).toContain("#### 図");
		expect(result.body).toContain("ゲート: AND1(AND)");
	});
});
