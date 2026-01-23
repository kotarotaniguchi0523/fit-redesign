import { Button, Card, CardBody, CardHeader, Link } from "@heroui/react";
import type { Exam, Year } from "../types/index";
import { QuestionCard } from "./QuestionCard";
import { YearSelector } from "./YearSelector";

interface Props {
	title: string;
	exam: Exam | undefined;
	selectedYear: Year;
	onYearChange: (year: Year) => void;
	availableYears: Year[];
}

export function ExamSection({ title, exam, selectedYear, onYearChange, availableYears }: Props) {
	return (
		<Card className="mt-4">
			<CardHeader className="flex justify-between items-center bg-gray-100">
				<h3 className="text-lg font-semibold">📝 {title}</h3>
				{exam && (
					<Button
						as={Link}
						href={exam.pdfPath}
						target="_blank"
						size="sm"
						variant="flat"
						color="primary"
					>
						PDF ↗
					</Button>
				)}
			</CardHeader>
			<CardBody>
				<YearSelector
					selectedYear={selectedYear}
					onYearChange={onYearChange}
					availableYears={availableYears}
				/>
				<div className="mt-4 border-t pt-4">
					{exam?.questions.map((q) => (
						<QuestionCard key={q.id} question={q} />
					))}
					{(!exam || exam.questions.length === 0) && (
						<p className="text-gray-500 italic">
							この年度の問題データはまだ準備中です。
							{exam && (
								<>
									<br />
									<Link href={exam.pdfPath} isExternal>
										PDFで確認する ↗
									</Link>
								</>
							)}
						</p>
					)}
				</div>
			</CardBody>
		</Card>
	);
}
