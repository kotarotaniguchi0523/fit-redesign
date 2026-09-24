/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { getExamByNumber } from "../../../data/exams";
import { unitBasedTabs } from "../../../data/units";
import ExamPlayer from "../../../features/challenge/$ExamPlayer";
import type { ExamNumber, QuestionId, Year } from "../../../types";
import { ExamNumberSchema, isYear } from "../../../types";
import { ChallengeIdSchema, QuestionIdSchema } from "../../../types/browser";

type ExamRouteSelection = Readonly<{
	unit: (typeof unitBasedTabs)[number];
	year: Year;
	examNumber: ExamNumber;
	questionId?: QuestionId;
}>;

function parseExamRouteSelection(
	unitId: string | undefined,
	yearParam: string | undefined,
	rawExamNumber: string | undefined,
	rawQuestionId: string | undefined,
): ExamRouteSelection | null {
	const unit = unitBasedTabs.find((tab) => tab.id === unitId);
	const year = yearParam && isYear(yearParam) ? yearParam : undefined;
	const examNumberResult = ExamNumberSchema.safeParse(Number(rawExamNumber));
	const examNumber = examNumberResult.success ? (examNumberResult.data as ExamNumber) : undefined;
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
	const questionIdResult = rawQuestionId ? QuestionIdSchema.safeParse(rawQuestionId) : null;
	if (rawQuestionId && !questionIdResult?.success) {
		return null;
	}
	return {
		unit,
		year,
		examNumber,
		questionId: questionIdResult?.success ? questionIdResult.data : undefined,
	};
}

export default createRoute(async (c) => {
	const challengeId = ChallengeIdSchema.safeParse(c.req.query("challenge"));
	const selection = parseExamRouteSelection(
		c.req.param("unit"),
		c.req.param("year"),
		c.req.query("exam"),
		c.req.query("question"),
	);
	if (!selection) {
		return c.notFound();
	}
	const { unit, year, examNumber, questionId: selectedQuestionId } = selection;

	const examByYear = await getExamByNumber(examNumber);
	const exam = examByYear?.exams[year];
	if (!exam) {
		return c.notFound();
	}

	if (
		selectedQuestionId &&
		!exam.questions.some((question) => question.id === selectedQuestionId)
	) {
		return c.notFound();
	}
	// The focus timer keeps one active question at a time, while the player needs
	// the full set to render its question drawer and edge navigation.
	const questions = exam.questions;
	const mode = selectedQuestionId ? "question" : "exam";
	const playerTitle = mode === "question" ? "タイムアタック" : `小テスト${examNumber}`;

	return c.render(
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
						questions={questions}
						mode={mode}
						requestedQuestionId={selectedQuestionId}
						initialChallengeId={challengeId.success ? challengeId.data : undefined}
						initialView={c.req.query("view") === "result" ? "result" : "player"}
					/>
				</div>
			</div>
		</main>,
		{
			title: `${playerTitle} - ${unit.name}・${year}年度`,
			description: "小テストを一問ずつ進め、問題ごとの時間と自己判定を記録できます。",
			noindex: true,
			noCanonical: true,
		},
	);
});
