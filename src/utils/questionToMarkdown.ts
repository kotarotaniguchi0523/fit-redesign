import type { FigureData, Question } from "../types/index";

/**
 * テーブルデータを Markdown 文字列に変換するヘルパー関数
 */
function tableToMarkdown(
	columns: Array<{ key: string; label: string }>,
	rows: Record<string, unknown>[],
): string {
	const header = `| ${columns.map((c) => c.label).join(" | ")} |`;
	const separator = `| ${columns.map(() => "---").join(" | ")} |`;
	const dataRows = rows.map((row) => {
		const cells = columns.map((c) => String(row[c.key] ?? ""));
		return `| ${cells.join(" | ")} |`;
	});
	return [header, separator].concat(dataRows).join("\n");
}

/**
 * FigureData を Markdown 文字列に変換する
 */
function figureDataToMarkdown(figureData: FigureData): string {
	switch (figureData.type) {
		case "truthTable":
			return tableToMarkdown(figureData.columns, figureData.rows);

		case "dataTable":
			return tableToMarkdown(figureData.columns, figureData.rows);

		case "huffmanTable": {
			const { characters, probabilities } = figureData.data;
			return ["| 文字 | 確率 |", "| --- | --- |"]
				.concat(characters.map((c, i) => `| ${c} | ${probabilities[i]} |`))
				.join("\n");
		}

		case "linkedListTable":
			return ["| アドレス | データ | ポインタ |", "| --- | --- | --- |"]
				.concat(figureData.entries.map((e) => `| ${e.address} | ${e.data} | ${e.pointer} |`))
				.join("\n");

		case "normalDistributionTable":
			return ["| u | 確率 |", "| --- | --- |"]
				.concat(figureData.entries.map((e) => `| ${e.u} | ${e.probability} |`))
				.join("\n");

		case "parityCheck":
			return figureData.data.map((row) => `| ${row.join(" | ")} |`).join("\n");

		case "stateDiagram": {
			const { nodes, transitions } = figureData;
			const nodeLines = nodes.map((node) => {
				const markers = ([] as string[])
					.concat(node.isInitial ? "初期状態" : [])
					.concat(node.isAccepting ? "受理状態" : []);
				const markerStr = markers.length > 0 ? ` (${markers.join(", ")})` : "";
				return `- ${node.label}${markerStr}`;
			});
			const transLines = transitions.map((t) => {
				const fromNode = nodes.find((n) => n.id === t.from);
				const toNode = nodes.find((n) => n.id === t.to);
				return `- ${fromNode?.label ?? t.from} --[${t.label}]--> ${toNode?.label ?? t.to}`;
			});
			return ["**状態遷移図**", "", "状態:"]
				.concat(nodeLines, ["", "遷移:"], transLines)
				.join("\n");
		}

		case "binaryTree": {
			const collectNodes = (node: typeof figureData.root | undefined, depth: number): string[] => {
				if (!node) return [];
				const indent = "  ".repeat(depth);
				return [indent.concat(`- ${node.value}`)].concat(
					collectNodes(node.left, depth + 1),
					collectNodes(node.right, depth + 1),
				);
			};
			return ["**二分木**", ""].concat(collectNodes(figureData.root, 0)).join("\n");
		}

		case "logicCircuit": {
			const { inputs, outputs, gates } = figureData;
			return [
				"**論理回路**",
				"",
				`入力: ${inputs.map((i) => i.label).join(", ")}`,
				`出力: ${outputs.map((o) => o.label).join(", ")}`,
				`ゲート: ${gates.map((g) => `${g.id}(${g.type})`).join(", ")}`,
			].join("\n");
		}

		case "flowchart": {
			const { nodes, edges } = figureData;
			const nodeLines = nodes.map((node) => `- [${node.type}] ${node.label}`);
			const edgeLines = edges.map((edge) => {
				const fromNode = nodes.find((n) => n.id === edge.from);
				const toNode = nodes.find((n) => n.id === edge.to);
				const label = edge.label ? ` (${edge.label})` : "";
				return `- ${fromNode?.label ?? edge.from} --> ${toNode?.label ?? edge.to}${label}`;
			});
			return ["**フローチャート**", "", "ノード:"]
				.concat(nodeLines, ["", "フロー:"], edgeLines)
				.join("\n");
		}

		default:
			return "";
	}
}

/**
 * Question オブジェクトを Markdown 文字列に変換する
 */
export function questionToMarkdown(question: Question): string {
	const base = [`## 問題 ${question.number}`, "", question.text, ""];

	const figure = question.figureData
		? ["### 図", "", figureDataToMarkdown(question.figureData), ""]
		: question.figureDescription
			? [`> **図**: ${question.figureDescription}`, ""]
			: [];

	const options =
		question.options && question.options.length > 0
			? ["### 選択肢"]
					.concat(
						question.options.map(
							(option) => `- **${option.label}**: ${option.value || "(未入力)"}`,
						),
					)
					.concat("")
			: [];

	const answer = ["### 解答", question.answer, ""];

	const explanation = question.explanation ? ["### 解説", question.explanation] : [];

	return base.concat(figure, options, answer, explanation).join("\n").trim();
}
