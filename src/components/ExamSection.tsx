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
		<Card className="mt-4 shadow-sm">
			<CardHeader className="flex flex-col gap-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
				<div className="flex justify-between items-center w-full">
					<h3 className="text-lg font-semibold flex items-center gap-2 text-[#1e3a5f]">
						<span className="w-8 h-8 rounded-lg bg-[#c9a227]/20 flex items-center justify-center">
							📝
						</span>
						{title}
					</h3>
					{exam && (
						<Button
							as={Link}
							href={exam.pdfPath}
							target="_blank"
							rel="noopener noreferrer"
							size="sm"
							variant="flat"
							className="bg-[#1e3a5f] text-white hover:bg-[#2d4a6f]"
						>
							PDF ↗
						</Button>
					)}
				</div>
				<YearSelector
					selectedYear={selectedYear}
					onYearChange={onYearChange}
					availableYears={availableYears}
				/>
			</CardHeader>
			<CardBody className="p-5">
				<div>
					{exam?.questions.map((q) => (
						<QuestionCard key={q.id} question={q} />
					))}
					{(!exam || exam.questions.length === 0) && (
						<p className="text-gray-500 italic">
							この年度の問題データはまだ準備中です。
							{exam && (
								<>
									<br />
									<Link
										href={exam.pdfPath}
										isExternal
										className="text-[#1e3a5f] hover:text-[#c9a227]"
									>
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
