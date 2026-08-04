import type { JSX } from "hono/jsx/jsx-runtime";
import type { Exam, ExamNumber, UnitTabId } from "../../types";
import { QuestionCard } from "./_QuestionCard";

interface ExamSectionProps {
	title: string;
	exam: Exam | undefined;
	examNumber: ExamNumber;
	unitId: UnitTabId;
	showExamLabel: boolean;
}

export function ExamSection({
	title,
	exam,
	examNumber,
	unitId,
	showExamLabel,
}: ExamSectionProps): JSX.Element {
	return (
		<section id={`exam-${examNumber}`} class="mt-6 scroll-mt-20">
			<div
				class={`mb-3 flex items-center gap-3 pb-2 ${showExamLabel ? "justify-between border-b-2 border-[#1e3a5f]" : "justify-end"}`}
			>
				{showExamLabel ? (
					<h2 class="font-bold text-[#1e3a5f]">
						小テスト{examNumber} — {title}
					</h2>
				) : null}
				{exam && (
					<a
						href={exam.pdfPath}
						target="_blank"
						rel="noopener noreferrer"
						class="shrink-0 text-sm font-bold text-[#1e3a5f] underline decoration-[#c9a227] underline-offset-4"
					>
						原本PDF ↗
					</a>
				)}
			</div>
			<div class="space-y-4">
				{exam?.questions.map((q) => (
					<QuestionCard question={q} unitId={unitId} />
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
