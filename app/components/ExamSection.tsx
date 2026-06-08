import type { Exam } from "../../src/types/index";
import { QuestionCard } from "./QuestionCard";

interface ExamSectionProps {
	title: string;
	exam: Exam | undefined;
}

export function ExamSection({ title, exam }: ExamSectionProps) {
	const questionCount = exam?.questions.length ?? 0;

	return (
		<section class="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
			<div class="flex flex-col gap-4 rounded-t-2xl border-b border-gray-200 bg-linear-to-r from-gray-50 to-slate-50 p-4">
				<div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-start gap-3">
						<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c9a227]/20">
							問
						</span>
						<div>
							<h2 class="text-lg font-bold leading-snug text-[#1e3a5f]">{title}</h2>
							<p class="mt-1 text-sm text-slate-500">
								{questionCount > 0
									? `${questionCount}問。上から順番でなくても大丈夫です。`
									: "問題データは準備中です。"}
							</p>
						</div>
					</div>
					{exam && (
						<a
							href={exam.pdfPath}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#2d4a6f]"
						>
							PDF ↗
						</a>
					)}
				</div>
			</div>
			<div class="space-y-4 p-4 sm:p-5">
				{exam?.questions.map((q) => <QuestionCard question={q} />)}
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
