import { Accordion, AccordionItem, Button, Card, CardBody, Tooltip } from "@heroui/react";
import { useClipboard } from "../hooks/useClipboard";
import type { FigureData, Question } from "../types/index";
import { questionToMarkdown } from "../utils/questionToMarkdown";
import {
	BinaryTree,
	Flowchart,
	LogicCircuit,
	ParityCheck,
	StateDiagram,
	TableRenderer,
	TruthTable,
} from "./figures";
import { CheckIcon, ClipboardIcon, ErrorIcon } from "./icons";
import { QuestionTimer } from "./QuestionTimer";

interface Props {
	question: Question;
}

function assertNever(value: never): never {
	throw new Error(`Unexpected figure type: ${JSON.stringify(value)}`);
}

function renderFigure(figureData: FigureData) {
	switch (figureData.type) {
		case "stateDiagram":
			return <StateDiagram nodes={figureData.nodes} transitions={figureData.transitions} />;
		case "binaryTree":
			return (
				<BinaryTree
					root={figureData.root}
					width={figureData.width}
					height={figureData.height}
				/>
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
			return assertNever(figureData);
	}
}

export function QuestionCard({ question }: Props) {
	const { copy, isCopied, error } = useClipboard();

	const handleCopy = async () => {
		const markdown = questionToMarkdown(question);
		await copy(markdown);
	};

	// ツールチップのテキストを状態に応じて変更
	const tooltipContent = error
		? "コピーに失敗しました"
		: isCopied
			? "コピーしました"
			: "Markdownでコピー";

	return (
		<Card className="mb-4 border-l-4 border-l-[#1e3a5f] shadow-sm hover:shadow-md transition-shadow">
			<CardBody className="p-5">
				<div className="flex gap-3">
					<span className="shrink-0 w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold">
						{question.number}
					</span>
					<div className="flex-1">
						<div className="flex items-start justify-between gap-2 mb-2">
							<p className="text-gray-800 leading-relaxed whitespace-pre-wrap flex-1">
								{question.text}
							</p>
							<div className="shrink-0 flex items-center gap-2">
								<Tooltip content={tooltipContent}>
									<Button
										size="sm"
										variant="light"
										isIconOnly
										onPress={handleCopy}
										className="text-slate-500 hover:text-[#1e3a5f]"
									>
										{error ? (
											<ErrorIcon className="w-4 h-4 text-red-500" />
										) : isCopied ? (
											<CheckIcon className="w-4 h-4 text-green-600" />
										) : (
											<ClipboardIcon className="w-4 h-4" />
										)}
									</Button>
								</Tooltip>
								<QuestionTimer questionId={question.id} />
							</div>
						</div>
					</div>
				</div>

				{question.figureData && (
					<div className="my-4 flex justify-center">{renderFigure(question.figureData)}</div>
				)}

				{!question.figureData && question.figureDescription && (
					<div className="my-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
						<p className="text-sm text-blue-800">
							<strong>図:</strong> {question.figureDescription}
						</p>
					</div>
				)}

				{/* 選択肢 */}
				{question.options && question.options.length > 0 && (
					<div className="mt-4 space-y-2">
						{question.options.map((option) => (
							<div
								key={option.label}
								className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
							>
								<span className="shrink-0 w-6 h-6 rounded bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold">
									{option.label}
								</span>
								<span className="text-gray-800">{option.value || "(選択肢未入力)"}</span>
							</div>
						))}
					</div>
				)}

				<Accordion variant="light" className="mt-4">
					<AccordionItem
						key="answer"
						aria-label="解答"
						title={<span className="text-sm font-medium text-[#1e3a5f]">解答を表示</span>}
					>
						<div className="p-4 bg-linear-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
							<div className="flex items-start gap-2">
								<span className="text-emerald-600 font-bold">A.</span>
								<span className="font-medium text-emerald-900">{question.answer}</span>
							</div>
						</div>
						{question.explanation && (
							<div className="mt-3 p-3 bg-gray-50 rounded-lg text-gray-600 text-sm">
								<strong>解説:</strong> {question.explanation}
							</div>
						)}
					</AccordionItem>
				</Accordion>
			</CardBody>
		</Card>
	);
}
