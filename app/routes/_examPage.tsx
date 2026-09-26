/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { getAllExams, getExamByNumber } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import ExamPlayer from "../features/challenge/$ExamPlayer";
import type { ExamNumber, QuestionId, Year } from "../types";
import { ExamNumberSchema, isYear } from "../types";
import { QuestionIdSchema } from "../types/browser";

type ExamSsgParam = Readonly<{ unit: string; year: Year; exam: string }>;
type QuestionSsgParam = ExamSsgParam & Readonly<{ question: QuestionId }>;

export async function getExamSsgParams(): Promise<ExamSsgParam[]> {
	const exams = new Map((await getAllExams()).map((exam) => [exam.examNumber, exam]));
	return unitBasedTabs.flatMap((unit) =>
		unit.examMapping.flatMap(({ year, examNumbers }) =>
			examNumbers.flatMap((examNumber) =>
				exams.get(examNumber)?.exams[year]
					? [{ unit: unit.id, year, exam: String(examNumber) }]
					: [],
			),
		),
	);
}

export async function getQuestionSsgParams(): Promise<QuestionSsgParam[]> {
	const exams = new Map((await getAllExams()).map((exam) => [exam.examNumber, exam]));
	return unitBasedTabs.flatMap((unit) =>
		unit.examMapping.flatMap(({ year, examNumbers }) =>
			examNumbers.flatMap((examNumber) => {
				const exam = exams.get(examNumber)?.exams[year];
				return exam
					? exam.questions.map((question) => ({
							unit: unit.id,
							year,
							exam: String(examNumber),
							question: question.id,
						}))
					: [];
			}),
		),
	);
}

export type ExamPageData = Readonly<{
	unit: (typeof unitBasedTabs)[number];
	year: Year;
	examNumber: ExamNumber;
	questionId?: QuestionId;
	exam: NonNullable<NonNullable<Awaited<ReturnType<typeof getExamByNumber>>>["exams"][Year]>;
}>;

export async function resolveExamPage(
	unitId: string | undefined,
	yearParam: string | undefined,
	rawExamNumber: string | undefined,
	rawQuestionId?: string,
): Promise<ExamPageData | null> {
	const unit = unitBasedTabs.find((tab) => tab.id === unitId);
	const year = yearParam && isYear(yearParam) ? yearParam : undefined;
	const examResult = ExamNumberSchema.safeParse(Number(rawExamNumber));
	const examNumber = examResult.success ? (examResult.data as ExamNumber) : undefined;
	if (
		!(
			unit &&
			year &&
			examNumber &&
			unit.examMapping.some(
				(mapping) => mapping.year === year && mapping.examNumbers.includes(examNumber),
			)
		)
	) {
		return null;
	}
	const questionResult = rawQuestionId ? QuestionIdSchema.safeParse(rawQuestionId) : undefined;
	if (rawQuestionId && !questionResult?.success) {
		return null;
	}
	const examByYear = await getExamByNumber(examNumber);
	const exam = examByYear?.exams[year];
	if (!exam) {
		return null;
	}
	const questionId = questionResult?.success ? questionResult.data : undefined;
	if (questionId && !exam.questions.some((question) => question.id === questionId)) {
		return null;
	}
	return { unit, year, examNumber, exam, questionId };
}

export function ExamPage({ data }: Readonly<{ data: ExamPageData }>): JSX.Element {
	const { unit, year, examNumber, exam, questionId } = data;
	const mode = questionId ? "question" : "exam";
	const playerTitle = mode === "question" ? "タイムアタック" : `小テスト${examNumber}`;
	return (
		<main id="main-content" class="study-shell study-shell--exam">
			<div class="page-container page-container--wide">
				<div class="content-panel exam-player-page">
					<h1 class="sr-only">
						{playerTitle} — {exam.title}
					</h1>
					<ExamPlayer
						examId={exam.id}
						examNumber={examNumber}
						year={year}
						unitId={unit.id}
						playerTitle={playerTitle}
						questions={exam.questions}
						mode={mode}
						requestedQuestionId={questionId}
					/>
				</div>
			</div>
		</main>
	);
}
