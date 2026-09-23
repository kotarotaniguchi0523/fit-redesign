import type { JSX } from "hono/jsx/jsx-runtime";
import type { Exam, ExamNumber, UnitTabId, Year } from "../../types";
import { QuestionCard } from "./_QuestionCard";

interface ExamSectionProps {
	title: string;
	exam: Exam | undefined;
	examNumber: ExamNumber;
	year: Year;
	unitId: UnitTabId;
	showExamLabel: boolean;
}

export function ExamSection({
	title,
	exam,
	examNumber,
	year,
	unitId,
	showExamLabel,
}: ExamSectionProps): JSX.Element {
	return (
		<section id={`exam-${examNumber}`} class="exam-section scroll-mt-20">
			<header class="exam-section__header">
				<div class="exam-section__title-group">
					<h2 class="exam-section__title">
						{showExamLabel ? `小テスト${examNumber} — ${title}` : `小テスト${examNumber}`}
					</h2>
				</div>
				<div class="exam-section__actions">
					{exam && (
						<a
							href={exam.pdfPath}
							target="_blank"
							rel="noopener noreferrer"
							class="exam-section__pdf"
						>
							原本PDF ↗
						</a>
					)}
					{exam ? (
						<a
							href={`/${unitId}/${year}/exam?exam=${examNumber}`}
							class="exam-start-link exam-section__start"
						>
							小テストを始める
						</a>
					) : null}
				</div>
			</header>
			<div class="exam-section__questions">
				{exam?.questions.map((q) => (
					<QuestionCard question={q} unitId={unitId} year={year} examNumber={examNumber} />
				))}
				{(!exam || exam.questions.length === 0) && (
					<p class="text-gray-500 italic">
						この年度の問題データはまだ準備中です。
						{exam?.pdfPath && (
							<a
								href={exam.pdfPath}
								target="_blank"
								rel="noopener noreferrer"
								class="text-[#1e3a5f] underline"
							>
								PDFで確認する ↗
							</a>
						)}
					</p>
				)}
			</div>
		</section>
	);
}
