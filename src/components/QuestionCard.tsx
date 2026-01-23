import { Accordion, AccordionItem, Card, CardBody } from "@heroui/react";
import type { FigureData, Question } from "../types/index";
import { BinaryTree, ParityCheck, StateDiagram, TruthTable } from "./figures";

interface Props {
	question: Question;
}

// 図を描画するヘルパー関数
function renderFigure(figureData: FigureData) {
	switch (figureData.type) {
		case "stateDiagram":
			return <StateDiagram nodes={figureData.nodes} transitions={figureData.transitions} />;
		case "binaryTree":
			return <BinaryTree root={figureData.root} />;
		case "truthTable":
			return <TruthTable columns={figureData.columns} rows={figureData.rows} />;
		case "parityCheck":
			return <ParityCheck data={figureData.data} />;
	}
}

export function QuestionCard({ question }: Props) {
	return (
		<Card className="mb-4">
			<CardBody>
				<div className="mb-2 font-medium">
					({question.number}) {question.text}
				</div>

				{/* 図を表示 */}
				{question.hasFigure && question.figureData && (
					<div className="my-4 flex justify-center">{renderFigure(question.figureData)}</div>
				)}

				{/* 図の説明文を表示（figureDataがない場合のフォールバック） */}
				{question.hasFigure && !question.figureData && question.figureDescription && (
					<div className="my-4 p-3 bg-blue-50 rounded border border-blue-200">
						<p className="text-sm text-blue-800">
							<strong>図:</strong> {question.figureDescription}
						</p>
					</div>
				)}

				<Accordion variant="bordered">
					<AccordionItem key="answer" aria-label="解答" title="解答を表示" className="text-sm">
						<div className="p-2 bg-green-50 rounded">
							<strong>解答:</strong> {question.answer}
						</div>
						{question.explanation && (
							<div className="mt-2 p-2 bg-gray-50 rounded text-gray-600">
								<strong>解説:</strong> {question.explanation}
							</div>
						)}
					</AccordionItem>
				</Accordion>
			</CardBody>
		</Card>
	);
}
