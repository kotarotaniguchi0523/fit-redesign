import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TableFigureData } from "./table-renderer.ts";
import { buildTableConfig } from "./table-renderer.ts";

describe("buildTableConfig", () => {
	describe("truthTable", () => {
		it("uses the shared table configuration without changing its content", () => {
			const data: TableFigureData = {
				type: "truthTable",
				columns: [{ key: "A", label: "A" }],
				rows: [{ A: 1 }],
			};
			const config = buildTableConfig(data);

			assert.equal(config.ariaLabel, "真理値表");
			assert.deepEqual(config.columns, data.columns);
			assert.deepEqual(config.rows, data.rows);
		});
	});

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

			assert.equal(config.ariaLabel, "Data table");
			assert.deepEqual(config.columns, data.columns);
			assert.deepEqual(config.rows, data.rows);
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

			assert.equal(config.ariaLabel, "Huffman coding table");
			assert.equal((config.columns).length, 2);
			assert.equal(config.columns[0].key, "character");
			assert.equal(config.columns[1].key, "probability");
			assert.deepEqual(config.rows, [
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

			assert.equal(config.ariaLabel, "Linked list table");
			assert.equal((config.columns).length, 3);
			assert.deepEqual(config.rows, [
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

			assert.deepEqual(config.rows, [{ address: "0x0A", data: "Z", pointer: "NULL" }]);
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

			assert.equal(config.ariaLabel, "Normal distribution table");
			assert.equal((config.columns).length, 2);
			assert.equal(config.columns[0].key, "u");
			assert.equal(config.columns[1].key, "probability");
			assert.deepEqual(config.rows, [
				{ u: 0.0, probability: 0.5 },
				{ u: 1.0, probability: 0.8413 },
				{ u: 2.0, probability: 0.9772 },
			]);
		});
	});
});
