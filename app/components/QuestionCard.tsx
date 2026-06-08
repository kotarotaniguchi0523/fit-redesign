/** @jsxImportSource hono/jsx */

import AnswerSelector from "../features/answer/$AnswerSelector";
import SelfGrade from "../features/answer/$SelfGrade";
import { questionToMarkdown } from "../features/markdown/questionToMarkdown";
import { overlineToHtml } from "../lib/overline";
import type { Question } from "../types";
import { BinaryTree } from "./figures/BinaryTree";
import { Flowchart } from "./figures/Flowchart";
import { LogicCircuit } from "./figures/LogicCircuit";
import { ParityCheck } from "./figures/ParityCheck";
import { StateDiagram } from "./figures/StateDiagram";
import { TableRenderer } from "./figures/TableRenderer";
import { TruthTable } from "./figures/TruthTable";

/**
 * 問題カード。
 *
 * 回答 UI は island（AnswerSelector / SelfGrade）に置き換え、props を直接渡す
 * （旧 data 属性スクレイプは廃止）。island は closest("[data-question-card]") で
 * このカードを解決し、`[data-status-chip]` / `[data-solution]` / `[data-question-timer]`
 * を操作するため、これらの DOM フックを正確に再現する。
 *
 * timer（question-timer）と copy-button は命令的 client script（app/client.ts が配線）
 * なので、`data-question-timer` / `data-copy-button` 属性付き要素を出力するだけにする。
 *
 * ExamSection / today ルートが `import { QuestionCard }` で参照するため named export。
 */

interface Props {
	question: Question;
}

export function QuestionCard({ question }: Props) {
	const markdownText = questionToMarkdown(question);
	const hasOptions = !!question.options && question.options.length > 0;
	const figureData = question.figureData;

	return (
		<article data-question-card data-question-id={question.id} class="q-card">
			{/* 進捗チップ（回答後に island が表示） */}
			<div data-status-chip hidden class="q-chip" />

			<div class="q-card__body">
				{/* 1. 問題番号 + 種別 */}
				<header class="q-head">
					<span class="q-num">{question.number}</span>
					<div>
						<p class="q-eyebrow">問題 {question.number}</p>
						{hasOptions && <p class="q-hint">選択肢を1つ選んで確かめよう</p>}
					</div>
				</header>

				{/* 2. 問題文 */}
				<div class="q-text-wrap">
					<p
						class="q-text"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
						dangerouslySetInnerHTML={{ __html: overlineToHtml(question.text) }}
					/>
				</div>

				{/* 3. 図表 */}
				{figureData ? (
					<div class="q-figure-wrap">
						{figureData.type === "stateDiagram" ? (
							<StateDiagram nodes={figureData.nodes} transitions={figureData.transitions} />
						) : null}
						{figureData.type === "binaryTree" ? (
							<BinaryTree
								root={figureData.root}
								width={figureData.width}
								height={figureData.height}
							/>
						) : null}
						{figureData.type === "truthTable" ? (
							<TruthTable columns={figureData.columns} rows={figureData.rows} />
						) : null}
						{figureData.type === "parityCheck" ? <ParityCheck data={figureData.data} /> : null}
						{figureData.type === "logicCircuit" ? (
							<LogicCircuit
								inputs={figureData.inputs}
								outputs={figureData.outputs}
								gates={figureData.gates}
								wires={figureData.wires}
							/>
						) : null}
						{figureData.type === "flowchart" ? (
							<Flowchart
								nodes={figureData.nodes}
								edges={figureData.edges}
								width={figureData.width}
								height={figureData.height}
							/>
						) : null}
						{figureData.type === "dataTable" ||
						figureData.type === "huffmanTable" ||
						figureData.type === "linkedListTable" ||
						figureData.type === "normalDistributionTable" ? (
							<TableRenderer figureData={figureData} />
						) : null}
					</div>
				) : null}

				{!figureData && question.figureDescription ? (
					<div class="q-figure-fallback">
						<strong>図:</strong>{" "}
						<span
							// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
							dangerouslySetInnerHTML={{ __html: overlineToHtml(question.figureDescription) }}
						/>
					</div>
				) : null}

				{/* 4. 回答（選択式 island or 記述式の自己採点 island） */}
				{hasOptions ? (
					<div class="q-options">
						<AnswerSelector
							questionId={question.id}
							correctLabel={question.answer}
							options={(question.options ?? []).map((option) => ({
								label: option.label,
								html: overlineToHtml(option.value || "(選択肢未入力)"),
							}))}
						/>
					</div>
				) : (
					<div class="mt-4 block">
						<SelfGrade questionId={question.id} />
					</div>
				)}

				{/* 5. 解き方パネル（回答後に island が表示） */}
				<div data-solution hidden class="q-solution">
					<p class="q-solution__title">解き方</p>
					<div class="q-solution__answer">
						<span class="q-solution__answer-label">答え</span>
						<span
							class="q-solution__answer-value"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
							dangerouslySetInnerHTML={{ __html: overlineToHtml(question.answer) }}
						/>
					</div>
					{question.explanation ? (
						<p
							class="q-solution__explanation"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: overline 変換済み HTML の注入（旧 set:html と同等）
							dangerouslySetInnerHTML={{ __html: overlineToHtml(question.explanation) }}
						/>
					) : null}
				</div>

				{/* 6. ツール（控えめなフッター） */}
				<footer class="q-footer">
					<div data-question-timer data-question-id={question.id} />
					<button
						type="button"
						data-copy-button
						data-copy-text={markdownText}
						class="q-tool"
						aria-label="Markdownでコピー"
						title="Markdownでコピー"
					>
						<svg
							class="copy-icon h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<title>copy</title>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
						<svg
							class="check-icon hidden h-4 w-4 text-green-600"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<title>copied</title>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</button>
				</footer>
			</div>
		</article>
	);
}
