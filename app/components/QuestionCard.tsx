/** @jsxImportSource hono/jsx */

import AnswerSelector from "../features/answer/$AnswerSelector";
import SelfGrade from "../features/answer/$SelfGrade";
import CopyButton from "../features/markdown/$CopyButton";
import { questionToMarkdown } from "../features/markdown/questionToMarkdown";
import QuestionTimer from "../features/timer/$QuestionTimer";
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
 * （旧 data 属性スクレイプは廃止）。採点チップと解説パネルも island の状態から
 * 宣言的に描画し、カード外 DOM への反映処理を持たない。
 *
 * timer と copy button は island が所有する。
 *
 * ExamSection / today ルートが `import { QuestionCard }` で参照するため named export。
 */

interface Props {
	question: Question;
	/**
	 * 初期 SSR で `hidden` 属性を付けるか。today（dailySession）は全カードを
	 * `hidden` で出力し、初回ペイントの「全部見え→1枚に畳む」崩壊を消す。
	 * 未指定時は属性を出さない（hono/jsx は `hidden={undefined}` で属性を省く）ため
	 * 年度別ページ / ExamSection には無影響。
	 */
	hidden?: boolean;
}

function renderFigure(figureData: Question["figureData"]) {
	if (!figureData) return null;

	switch (figureData.type) {
		case "stateDiagram":
			return <StateDiagram nodes={figureData.nodes} transitions={figureData.transitions} />;
		case "binaryTree":
			return (
				<BinaryTree root={figureData.root} width={figureData.width} height={figureData.height} />
			);
		case "truthTable":
			return <TruthTable columns={figureData.columns} rows={figureData.rows} />;
		case "parityCheck":
			return <ParityCheck data={figureData.data} />;
		case "logicCircuit":
			return (
				<LogicCircuit
					inputs={figureData.inputs}
					outputs={figureData.outputs}
					gates={figureData.gates}
					wires={figureData.wires}
				/>
			);
		case "flowchart":
			return (
				<Flowchart
					nodes={figureData.nodes}
					edges={figureData.edges}
					width={figureData.width}
					height={figureData.height}
				/>
			);
		case "dataTable":
		case "huffmanTable":
		case "linkedListTable":
		case "normalDistributionTable":
			return <TableRenderer figureData={figureData} />;
		default:
			return null;
	}
}

function buildQuestionView(question: Question) {
	const hasOptions = !!question.options?.length;
	const answerHtml = overlineToHtml(question.answer);
	const explanationHtml = question.explanation ? overlineToHtml(question.explanation) : undefined;
	const options = (question.options ?? []).map((option) => ({
		label: option.label,
		html: overlineToHtml(option.value || "(選択肢未入力)"),
	}));

	return {
		markdownText: questionToMarkdown(question),
		hasOptions,
		figure: renderFigure(question.figureData),
		answerHtml,
		explanationHtml,
		options,
	};
}

export function QuestionCard({ question, hidden }: Props) {
	const view = buildQuestionView(question);
	const figureData = question.figureData;

	return (
		<article data-question-card data-question-id={question.id} class="q-card" hidden={hidden}>
			<div class="q-card__body">
				{/* 1. 問題番号 + 種別 */}
				<header class="q-head">
					<span class="q-num">{question.number}</span>
					<div>
						<p class="q-eyebrow">問題 {question.number}</p>
						{view.hasOptions && <p class="q-hint">選択肢を1つ選んで確かめよう</p>}
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
				{figureData ? <div class="q-figure-wrap">{view.figure}</div> : null}

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
				{view.hasOptions ? (
					<div class="q-options">
						<AnswerSelector
							questionId={question.id}
							correctLabel={question.answer}
							answerHtml={view.answerHtml}
							explanationHtml={view.explanationHtml}
							options={view.options}
						/>
					</div>
				) : (
					<div class="mt-4 block">
						<SelfGrade
							questionId={question.id}
							answerHtml={view.answerHtml}
							explanationHtml={view.explanationHtml}
						/>
					</div>
				)}

				{/* 6. ツール（控えめなフッター） */}
				<footer class="q-footer">
					<QuestionTimer questionId={question.id} />
					<CopyButton
						text={view.markdownText}
						className="q-tool"
						ariaLabel="Markdownでコピー"
						title="Markdownでコピー"
					/>
				</footer>
			</div>
		</article>
	);
}
