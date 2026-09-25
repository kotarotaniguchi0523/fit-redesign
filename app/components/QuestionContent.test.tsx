import { render } from "hono/jsx/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { Question } from "../types";
import { QuestionContent } from "./QuestionContent";

const question: Question = {
	id: "exam1-2013-q1",
	number: 1,
	text: "共有する問題文",
	answer: "ア",
	figureDescription: "図データがない場合の説明",
	figureData: {
		type: "truthTable",
		columns: [{ key: "input", label: "入力" }],
		rows: [{ input: 1 }],
	},
	options: [{ label: "ア", value: "選択肢の内容" }],
};

describe("QuestionContent", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it.each(["question-set", "exam-player"] as const)(
		"%s で本文・図表・選択肢を同じ規則で描画する",
		(variant) => {
			const container = document.createElement("div");
			document.body.appendChild(container);
			render(<QuestionContent question={question} variant={variant} />, container);

			expect(container.textContent).toContain("共有する問題文");
			expect(container.querySelector('table[aria-label="真理値表"]')).not.toBeNull();
			expect(container.querySelector('[aria-label="選択肢"]')?.textContent).toContain(
				"選択肢の内容",
			);
			expect(container.textContent).not.toContain("図データがない場合の説明");
		},
	);
});
