import type { FigureData, LinkedListEntry, NormalDistributionEntry } from "../../types/index";

export type TableFigureData = Extract<
	FigureData,
	| { type: "dataTable" }
	| { type: "huffmanTable" }
	| { type: "linkedListTable" }
	| { type: "normalDistributionTable" }
>;

export interface TableConfig {
	ariaLabel: string;
	columns: { key: string; label: string }[];
	rows: Record<string, unknown>[];
}

export function buildTableConfig(data: TableFigureData): TableConfig {
	switch (data.type) {
		case "dataTable":
			return {
				ariaLabel: "Data table",
				columns: data.columns,
				rows: data.rows,
			};
		case "huffmanTable":
			return {
				ariaLabel: "Huffman coding table",
				columns: [
					{ key: "character", label: "文字" },
					{ key: "probability", label: "確率" },
				],
				rows: data.data.characters.map((character: string, index: number) => ({
					character,
					probability: data.data.probabilities[index],
				})),
			};
		case "linkedListTable":
			return {
				ariaLabel: "Linked list table",
				columns: [
					{ key: "address", label: "アドレス" },
					{ key: "data", label: "データ" },
					{ key: "pointer", label: "ポインタ" },
				],
				rows: data.entries.map((entry: LinkedListEntry) => ({
					address: String(entry.address),
					data: entry.data,
					pointer: String(entry.pointer),
				})),
			};
		case "normalDistributionTable":
			return {
				ariaLabel: "Normal distribution table",
				columns: [
					{ key: "u", label: "u" },
					{ key: "probability", label: "確率" },
				],
				rows: data.entries.map((entry: NormalDistributionEntry) => ({
					u: entry.u,
					probability: entry.probability,
				})),
			};
	}
}
