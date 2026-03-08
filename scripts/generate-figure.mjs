#!/usr/bin/env node
/**
 * 図データJSON自動生成スクリプト
 *
 * PDFスクリーンショットからClaude CLIを使ってFigureData JSONを自動生成し、
 * 指定したexam JSONファイルに直接書き込む。
 *
 * Usage:
 *   pnpm figure-gen <image> [options]
 *
 * Examples:
 *   # JSON を stdout に出力
 *   pnpm figure-gen screenshots/exam3-q2.png
 *
 *   # 図タイプを指定
 *   pnpm figure-gen screenshots/exam3-q2.png --type stateDiagram
 *
 *   # exam JSON の特定の問題に直接書き込み
 *   pnpm figure-gen screenshots/exam3-q2.png --write exam3-2015 3
 *
 *   # テキスト説明から生成（画像なし）
 *   pnpm figure-gen --describe "S0→S1(a), S1→S0(b), S0 is initial, S1 is accepting" --type stateDiagram
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// ─── 引数パース ─────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
	const idx = args.indexOf(`--${name}`);
	if (idx === -1) return undefined;
	const val = args[idx + 1];
	args.splice(idx, 2);
	return val;
}

function getFlagMulti(name, count) {
	const idx = args.indexOf(`--${name}`);
	if (idx === -1) return undefined;
	const vals = args.slice(idx + 1, idx + 1 + count);
	args.splice(idx, 1 + count);
	return vals;
}

const figureType = getFlag("type");
const describe = getFlag("describe");
const writeTarget = getFlagMulti("write", 2); // [examId, questionNumber]
const imagePath = args[0]; // 残りの最初の引数

if (!imagePath && !describe) {
	console.error(`Usage: pnpm figure-gen <image-path> [options]
       pnpm figure-gen --describe "説明テキスト" [options]

Options:
  --type <figureType>          図タイプを指定 (stateDiagram, logicCircuit, etc.)
  --write <examId> <questionN> exam JSONに直接書き込み (例: --write exam3-2015 3)
  --describe "テキスト"         画像の代わりにテキスト説明で生成`);
	process.exit(1);
}

if (imagePath && !existsSync(imagePath)) {
	const absPath = path.resolve(repoRoot, imagePath);
	if (!existsSync(absPath)) {
		console.error(`Error: Image not found: ${imagePath}`);
		process.exit(1);
	}
}

// ─── プロンプト構築 ──────────────────────────────────────

const FIGURE_TYPES_SCHEMA = `
FigureData は以下の discriminated union 型:

1. stateDiagram: { type: "stateDiagram", nodes: StateNode[], transitions: Transition[] }
   StateNode: { id: string, label: string, x: number, y: number, isInitial?: boolean, isAccepting?: boolean }
   Transition: { from: string, to: string, label: string, curveOffset?: number }
   - SVG viewBox は width=400, height=150 がデフォルト
   - ノード半径は20px。ノード間の距離は最低80px以上
   - isInitial: true のノードには左から矢印が入る（x >= 60 にする）
   - curveOffset: 双方向遷移がある場合は 20〜30 を指定（上に曲がる）

2. logicCircuit: { type: "logicCircuit", inputs: LogicInput[], outputs: LogicOutput[], gates: LogicGate[], wires: LogicWire[] }
   LogicInput: { id: string, label: string, x: number, y: number }
   LogicOutput: { id: string, label: string, x: number, y: number, input: string }
   LogicGate: { id: string, type: "AND"|"OR"|"NOT"|"NAND"|"NOR"|"XOR"|"XNOR", x: number, y: number }
   LogicWire: { from: string, to: string, points?: {x,y}[] }
   - ゲート幅50, 高さ40。入力は左、出力は右
   - 入力ラベルは x-10 の位置に表示される

3. flowchart: { type: "flowchart", nodes: FlowchartNode[], edges: FlowchartEdge[], width?: number, height?: number }
   FlowchartNode: { id: string, type: "start"|"end"|"process"|"decision"|"connector", label: string, x: number, y: number, width?: number, height?: number }
   FlowchartEdge: { from: string, to: string, label?: string, fromSide?: "bottom"|"right"|"left"|"top", toSide?: "top"|"right"|"left"|"bottom", points?: {x,y}[] }
   - デフォルト幅 300, 高さ 400

4. binaryTree: { type: "binaryTree", root: TreeNode, width?: number, height?: number }
   TreeNode: { value: string|number, left?: TreeNode, right?: TreeNode }
   - 座標は自動計算される（x, y 指定不要）

5. truthTable: { type: "truthTable", columns: {key,label}[], rows: {[key]: string|number|boolean}[] }

6. parityCheck: { type: "parityCheck", data: number[][] }
   - 2次元配列。各セルは 0 or 1

7. dataTable: { type: "dataTable", columns: {key,label}[], rows: {[key]: string|number}[] }

8. huffmanTable: { type: "huffmanTable", data: { characters: string[], probabilities: number[] } }

9. linkedListTable: { type: "linkedListTable", entries: { address: string|number, data: string, pointer: string|number }[] }

10. normalDistributionTable: { type: "normalDistributionTable", entries: { u: number, probability: number }[] }
`;

function buildPrompt() {
	let prompt = "";

	if (imagePath) {
		const absImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(repoRoot, imagePath);
		prompt += `Read the image at "${absImagePath}" using the Read tool.\n\n`;
	}

	prompt += `あなたは FigureData JSON を生成するアシスタントです。

## タスク
`;

	if (imagePath) {
		prompt += "上記の画像に含まれる図を解析し、対応する FigureData JSON を生成してください。\n";
	}
	if (describe) {
		prompt += `以下の説明から FigureData JSON を生成してください:\n${describe}\n`;
	}

	if (figureType) {
		prompt += `\n図タイプは "${figureType}" です。\n`;
	} else {
		prompt += "\n画像/説明から適切な図タイプを自動判定してください。\n";
	}

	prompt += `
## FigureData 型定義
${FIGURE_TYPES_SCHEMA}

## 出力ルール
1. JSON のみを出力。\`\`\`json ブロックで囲んでください
2. 余計な説明は不要
3. 座標はSVGのviewBox内に収まるように設定
4. ノードIDは短い英数字（s0, s1, g1 等）
5. ラベルは画像/説明にある通りに正確に転記
6. 型に必須のフィールドは全て含める
`;

	return prompt;
}

// ─── Claude CLI 実行 ─────────────────────────────────────

const prompt = buildPrompt();

console.error("[figure-gen] Claude CLI を実行中...");

let claudeOutput;
try {
	claudeOutput = execSync(
		"claude -p --dangerously-skip-permissions",
		{
			input: prompt,
			cwd: repoRoot,
			encoding: "utf8",
			maxBuffer: 1024 * 1024 * 10, // 10MB
			timeout: 120_000, // 2分タイムアウト
		},
	);
} catch (e) {
	console.error(`Error: Claude CLI failed: ${e.message}`);
	if (e.stderr) console.error(e.stderr);
	process.exit(1);
}

// ─── JSON 抽出 ───────────────────────────────────────────

function extractJson(output) {
	// ```json ... ``` ブロックを探す
	const jsonBlockMatch = output.match(/```json\s*\n([\s\S]*?)\n\s*```/);
	if (jsonBlockMatch) {
		return jsonBlockMatch[1].trim();
	}

	// ブロックがない場合、最初の { から最後の } を探す
	const firstBrace = output.indexOf("{");
	const lastBrace = output.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		return output.substring(firstBrace, lastBrace + 1);
	}

	return null;
}

const jsonStr = extractJson(claudeOutput);

if (!jsonStr) {
	console.error("Error: Claude の出力から JSON を抽出できませんでした");
	console.error("Claude output:", claudeOutput);
	process.exit(1);
}

let figureData;
try {
	figureData = JSON.parse(jsonStr);
} catch (e) {
	console.error("Error: JSON パースに失敗:", e.message);
	console.error("Extracted JSON:", jsonStr);
	process.exit(1);
}

// type フィールドの検証
const validTypes = [
	"stateDiagram", "logicCircuit", "flowchart", "binaryTree",
	"truthTable", "parityCheck", "dataTable", "huffmanTable",
	"linkedListTable", "normalDistributionTable",
];
if (!figureData.type || !validTypes.includes(figureData.type)) {
	console.error(`Error: 無効な図タイプ: "${figureData.type}"`);
	console.error(`有効なタイプ: ${validTypes.join(", ")}`);
	process.exit(1);
}

// ─── 出力 / 書き込み ────────────────────────────────────

const prettyJson = JSON.stringify(figureData, null, "\t");

if (!writeTarget) {
	// stdout に JSON 出力
	console.log(prettyJson);
	console.error(`\n[figure-gen] ✓ ${figureData.type} の JSON を生成しました`);
} else {
	// exam JSON に書き込み
	const [examId, questionNumStr] = writeTarget;
	const questionNum = Number.parseInt(questionNumStr, 10);

	if (Number.isNaN(questionNum) || questionNum < 1) {
		console.error(`Error: 無効な問題番号: "${questionNumStr}"`);
		process.exit(1);
	}

	const examPath = path.join(repoRoot, "src/content/exams", `${examId}.json`);
	if (!existsSync(examPath)) {
		console.error(`Error: Exam file not found: ${examPath}`);
		process.exit(1);
	}

	const examData = JSON.parse(readFileSync(examPath, "utf8"));

	const question = examData.questions.find((q) => q.number === questionNum);
	if (!question) {
		console.error(`Error: 問題 ${questionNum} が ${examId} に見つかりません`);
		console.error(`存在する問題番号: ${examData.questions.map((q) => q.number).join(", ")}`);
		process.exit(1);
	}

	question.figureData = figureData;

	writeFileSync(examPath, `${JSON.stringify(examData, null, "\t")}\n`, "utf8");
	console.error(`[figure-gen] ✓ ${examId} の問題 ${questionNum} に ${figureData.type} を書き込みました`);
	console.error(`  → ${examPath}`);
}
