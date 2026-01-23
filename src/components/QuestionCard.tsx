import { Accordion, AccordionItem, Card, CardBody } from "@heroui/react";
import type { Question } from "../types/index";

interface Props {
	question: Question;
}

export function QuestionCard({ question }: Props) {
	return (
		<Card className="mb-4">
			<CardBody>
				<div className="mb-2 font-medium">
					({question.number}) {question.text}
				</div>
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
