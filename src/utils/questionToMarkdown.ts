import type { FigureData, Question } from "../types/index";

/**
 * FigureData を Markdown 文字列に変換する
 */
function figureDataToMarkdown(figureData: FigureData): string {
	switch (figureData.type) {
		case "truthTable": {
			const { columns, rows } = figureData;
			const lines: string[] = [];
			// ヘッダー行
			lines.push(`| ${columns.map((c) => c.label).join(" | ")} |`);
			// 区切り行
			lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
			// データ行
			for (const row of rows) {
				const cells = columns.map((c) => String(row[c.key] ?? ""));
				lines.push(`| ${cells.join(" | ")} |`);
			}
			return lines.join("\n");
		}

		case "dataTable": {
			const { columns, rows } = figureData;
			const lines: string[] = [];
			lines.push(`| ${columns.map((c) => c.label).join(" | ")} |`);
			lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
			for (const row of rows) {
				const cells = columns.map((c) => String(row[c.key] ?? ""));
				lines.push(`| ${cells.join(" | ")} |`);
			}
			return lines.join("\n");
		}

		case "huffmanTable": {
			const { characters, probabilities } = figureData.data;
			const lines: string[] = [];
			lines.push("| 文字 | 確率 |");
			lines.push("| --- | --- |");
			for (let i = 0; i < characters.length; i++) {
				lines.push(`| ${characters[i]} | ${probabilities[i]} |`);
			}
			return lines.join("\n");
		}

		case "linkedListTable": {
			const { entries } = figureData;
			const lines: string[] = [];
			lines.push("| アドレス | データ | ポインタ |");
			lines.push("| --- | --- | --- |");
			for (const entry of entries) {
				lines.push(`| ${entry.address} | ${entry.data} | ${entry.pointer} |`);
			}
			return lines.join("\n");
		}

		case "normalDistributionTable": {
			const { entries } = figureData;
			const lines: string[] = [];
			lines.push("| u | 確率 |");
			lines.push("| --- | --- |");
			for (const entry of entries) {
				lines.push(`| ${entry.u} | ${entry.probability} |`);
			}
			return lines.join("\n");
		}

		case "parityCheck": {
			const { data } = figureData;
			const lines: string[] = [];
			for (const row of data) {
				lines.push(`| ${row.join(" | ")} |`);
			}
			return lines.join("\n");
		}

		case "stateDiagram": {
			const { nodes, transitions } = figureData;
			const lines: string[] = [];
			lines.push("**状態遷移図**");
			lines.push("");
			lines.push("状態:");
			for (const node of nodes) {
				const markers: string[] = [];
				if (node.isInitial) markers.push("初期状態");
				if (node.isAccepting) markers.push("受理状態");
				const markerStr = markers.length > 0 ? ` (${markers.join(", ")})` : "";
				lines.push(`- ${node.label}${markerStr}`);
			}
			lines.push("");
			lines.push("遷移:");
			for (const t of transitions) {
				const fromNode = nodes.find((n) => n.id === t.from);
				const toNode = nodes.find((n) => n.id === t.to);
				lines.push(`- ${fromNode?.label ?? t.from} --[${t.label}]--> ${toNode?.label ?? t.to}`);
			}
			return lines.join("\n");
		}

		case "binaryTree": {
			// 二分木をテキストで表現（簡易版）
			const lines: string[] = [];
			lines.push("**二分木**");
			lines.push("");
			const printNode = (node: typeof figureData.root, depth: number): void => {
				if (!node) return;
				const indent = "  ".repeat(depth);
				lines.push(`${indent}- ${node.value}`);
				if (node.left) printNode(node.left, depth + 1);
				if (node.right) printNode(node.right, depth + 1);
			};
			printNode(figureData.root, 0);
			return lines.join("\n");
		}

		case "logicCircuit": {
			const { inputs, outputs, gates } = figureData;
			const lines: string[] = [];
			lines.push("**論理回路**");
			lines.push("");
			lines.push(`入力: ${inputs.map((i) => i.label).join(", ")}`);
			lines.push(`出力: ${outputs.map((o) => o.label).join(", ")}`);
			lines.push(`ゲート: ${gates.map((g) => `${g.id}(${g.type})`).join(", ")}`);
			return lines.join("\n");
		}

		case "flowchart": {
			const { nodes, edges } = figureData;
			const lines: string[] = [];
			lines.push("**フローチャート**");
			lines.push("");
			lines.push("ノード:");
			for (const node of nodes) {
				lines.push(`- [${node.type}] ${node.label}`);
			}
			lines.push("");
			lines.push("フロー:");
			for (const edge of edges) {
				const fromNode = nodes.find((n) => n.id === edge.from);
				const toNode = nodes.find((n) => n.id === edge.to);
				const label = edge.label ? ` (${edge.label})` : "";
				lines.push(`- ${fromNode?.label ?? edge.from} --> ${toNode?.label ?? edge.to}${label}`);
			}
			return lines.join("\n");
		}

		default:
			return "";
	}
}

/**
 * Question オブジェクトを Markdown 文字列に変換する
 */
export function questionToMarkdown(question: Question): string {
	const lines: string[] = [];

	// 問題番号と問題文
	lines.push(`## 問題 ${question.number}`);
	lines.push("");
	lines.push(question.text);
	lines.push("");

	// 図データ（figureDataがある場合は詳細に出力）
	if (question.figureData) {
		lines.push("### 図");
		lines.push("");
		lines.push(figureDataToMarkdown(question.figureData));
		lines.push("");
	} else if (question.figureDescription) {
		// figureDataがない場合のみfigureDescriptionを使用
		lines.push(`> **図**: ${question.figureDescription}`);
		lines.push("");
	}

	// 選択肢（あれば）
	if (question.options && question.options.length > 0) {
		lines.push("### 選択肢");
		for (const option of question.options) {
			lines.push(`- **${option.label}**: ${option.value || "(未入力)"}`);
		}
		lines.push("");
	}

	// 解答
	lines.push("### 解答");
	lines.push(question.answer);
	lines.push("");

	// 解説（あれば）
	if (question.explanation) {
		lines.push("### 解説");
		lines.push(question.explanation);
	}

	return lines.join("\n").trim();
}
