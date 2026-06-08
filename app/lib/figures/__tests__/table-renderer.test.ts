import { describe, expect, it } from "vitest";
import type { TableFigureData } from "../table-renderer";
import { buildTableConfig } from "../table-renderer";

describe("buildTableConfig", () => {
	describe("dataTable", () => {
		it("passes through columns and rows as-is", () => {
			const data: TableFigureData = {
				type: "dataTable",
				columns: [
					{ key: "name", label: "Name" },
					{ key: "value", label: "Value" },
				],
				rows: [
					{ name: "alpha", value: 1 },
					{ name: "beta", value: 2 },
				],
			};
			const config = buildTableConfig(data);

			expect(config.ariaLabel).toBe("Data table");
			expect(config.columns).toEqual(data.columns);
			expect(config.rows).toEqual(data.rows);
		});
	});

	describe("huffmanTable", () => {
		it("transforms characters and probabilities into rows", () => {
			const data: TableFigureData = {
				type: "huffmanTable",
				data: {
					characters: ["A", "B", "C"],
					probabilities: [0.5, 0.3, 0.2],
				},
			};
			const config = buildTableConfig(data);

			expect(config.ariaLabel).toBe("Huffman coding table");
			expect(config.columns).toHaveLength(2);
			expect(config.columns[0].key).toBe("character");
			expect(config.columns[1].key).toBe("probability");
			expect(config.rows).toEqual([
				{ character: "A", probability: 0.5 },
				{ character: "B", probability: 0.3 },
				{ character: "C", probability: 0.2 },
			]);
		});
	});

	describe("linkedListTable", () => {
		it("transforms entries into rows with string conversion", () => {
			const data: TableFigureData = {
				type: "linkedListTable",
				entries: [
					{ address: 100, data: "X", pointer: 200 },
					{ address: 200, data: "Y", pointer: -1 },
				],
			};
			const config = buildTableConfig(data);

			expect(config.ariaLabel).toBe("Linked list table");
			expect(config.columns).toHaveLength(3);
			expect(config.rows).toEqual([
				{ address: "100", data: "X", pointer: "200" },
				{ address: "200", data: "Y", pointer: "-1" },
			]);
		});

		it("handles string addresses and pointers", () => {
			const data: TableFigureData = {
				type: "linkedListTable",
				entries: [{ address: "0x0A", data: "Z", pointer: "NULL" }],
			};
			const config = buildTableConfig(data);

			expect(config.rows).toEqual([{ address: "0x0A", data: "Z", pointer: "NULL" }]);
		});
	});

	describe("normalDistributionTable", () => {
		it("transforms entries into rows with u and probability columns", () => {
			const data: TableFigureData = {
				type: "normalDistributionTable",
				entries: [
					{ u: 0.0, probability: 0.5 },
					{ u: 1.0, probability: 0.8413 },
					{ u: 2.0, probability: 0.9772 },
				],
			};
			const config = buildTableConfig(data);

			expect(config.ariaLabel).toBe("Normal distribution table");
			expect(config.columns).toHaveLength(2);
			expect(config.columns[0].key).toBe("u");
			expect(config.columns[1].key).toBe("probability");
			expect(config.rows).toEqual([
				{ u: 0.0, probability: 0.5 },
				{ u: 1.0, probability: 0.8413 },
				{ u: 2.0, probability: 0.9772 },
			]);
		});
	});
});
