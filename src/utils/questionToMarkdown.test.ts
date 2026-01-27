import { describe, expect, it } from "vitest";
import type { Question } from "../types/index";
import { questionToMarkdown } from "./questionToMarkdown";

describe("questionToMarkdown", () => {
	describe("基本的な問題", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-1",
				number: 1,
				text: "これはテスト問題です",
				answer: "ア",
			};

			result = questionToMarkdown(question);
		});

		it("問題番号を含む", () => {
			expect(result).toContain("## 問題 1");
		});

		it("問題文を含む", () => {
			expect(result).toContain("これはテスト問題です");
		});

		it("解答セクションを含む", () => {
			expect(result).toContain("### 解答");
		});

		it("正しい解答を含む", () => {
			expect(result).toContain("ア");
		});
	});

	describe("選択肢付き問題", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-2",
				number: 2,
				text: "選択肢問題です",
				answer: "イ",
				options: [
					{ label: "ア", value: "選択肢A" },
					{ label: "イ", value: "選択肢B" },
					{ label: "ウ", value: "選択肢C" },
					{ label: "エ", value: "選択肢D" },
				],
			};

			result = questionToMarkdown(question);
		});

		it("選択肢セクションを含む", () => {
			expect(result).toContain("### 選択肢");
		});

		it("アの選択肢を含む", () => {
			expect(result).toContain("**ア**: 選択肢A");
		});

		it("イの選択肢を含む", () => {
			expect(result).toContain("**イ**: 選択肢B");
		});
	});

	describe("解説付き問題", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-3",
				number: 3,
				text: "解説付き問題",
				answer: "ウ",
				explanation: "これは解説です",
			};

			result = questionToMarkdown(question);
		});

		it("解説セクションを含む", () => {
			expect(result).toContain("### 解説");
		});

		it("解説テキストを含む", () => {
			expect(result).toContain("これは解説です");
		});
	});

	describe("図の説明 (figureDescription)", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-4",
				number: 4,
				text: "図付き問題",
				answer: "エ",
				figureDescription: "テスト用の図",
			};

			result = questionToMarkdown(question);
		});

		it("図の説明を含む", () => {
			expect(result).toContain("**図**: テスト用の図");
		});
	});

	describe("truthTable figureData", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-5",
				number: 5,
				text: "真理値表問題",
				answer: "ア",
				figureData: {
					type: "truthTable",
					columns: [
						{ key: "A", label: "A" },
						{ key: "B", label: "B" },
						{ key: "Y", label: "Y" },
					],
					rows: [
						{ A: 0, B: 0, Y: 0 },
						{ A: 0, B: 1, Y: 1 },
						{ A: 1, B: 0, Y: 1 },
						{ A: 1, B: 1, Y: 0 },
					],
				},
			};

			result = questionToMarkdown(question);
		});

		it("図セクションを含む", () => {
			expect(result).toContain("### 図");
		});

		it("列ヘッダーを含む", () => {
			expect(result).toContain("| A | B | Y |");
		});

		it("最初の行を含む", () => {
			expect(result).toContain("| 0 | 0 | 0 |");
		});

		it("最後の行を含む", () => {
			expect(result).toContain("| 1 | 1 | 0 |");
		});
	});

	describe("stateDiagram figureData", () => {
		let result: string;

		beforeEach(() => {
			const question: Question = {
				id: "test-6",
				number: 6,
				text: "状態遷移図問題",
				answer: "イ",
				figureData: {
					type: "stateDiagram",
					nodes: [
						{ id: "s0", label: "S0", x: 0, y: 0, isInitial: true },
						{ id: "s1", label: "S1", x: 100, y: 0, isAccepting: true },
					],
					transitions: [{ from: "s0", to: "s1", label: "a" }],
				},
			};

			result = questionToMarkdown(question);
		});

		it("状態遷移図ラベルを含む", () => {
			expect(result).toContain("**状態遷移図**");
		});

		it("初期状態ラベルを含む", () => {
			expect(result).toContain("S0");
		});

		it("初期状態キーワードを含む", () => {
			expect(result).toContain("初期状態");
		});

		it("受理状態ラベルを含む", () => {
			expect(result).toContain("S1");
		});

		it("受理状態キーワードを含む", () => {
			expect(result).toContain("受理状態");
		});

		it("遷移を含む", () => {
			expect(result).toContain("--[a]-->");
		});
	});
});
