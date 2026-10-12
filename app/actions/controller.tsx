import { createController } from "remix/router";
import { loadHomeExamCatalog } from "../data/exams/homeCatalog.ts";
import { getExamByNumber } from "../data/exams/index.ts";
import { unitBasedTabs } from "../data/units.ts";
import { generateLlmsFullTxt, generateLlmsTxt } from "../features/markdown/llms.ts";
import { ExamPlayerPage } from "../pages/exam-player-page.tsx";
import { GuidePage } from "../pages/guide-page.tsx";
import { HomePage } from "../pages/home-page.tsx";
import { NotFoundPage } from "../pages/not-found-page.tsx";
import { RecordsPage } from "../pages/records-page.tsx";
import { SlideOnlyPage } from "../pages/slide-only-page.tsx";
import {
	buildUnitExamSections,
	getIntegratedTitle,
	UnitYearPage,
} from "../pages/unit-year-page.tsx";
import { routes } from "../routes.ts";
import type { ExamNumber, Year } from "../types/index.ts";

/**
 * ルートコントローラー。`routes.ts` の直下のルートリーフを担当する。
 * 入れ子のルートマップ（markdown / progress）は別コントローラーが持つ。
 */
export default createController(routes, {
	actions: {
		async home(context) {
			const { examCounts, locationGroups } = await loadHomeExamCatalog();
			return context.render(
				<HomePage
					examCounts={examCounts}
					locationGroups={locationGroups}
					currentPath={context.url.pathname}
				/>,
				{ headers: { "Cache-Control": "public, s-maxage=31536000, max-age=3600" } },
			);
		},

		guide(context) {
			return context.render(<GuidePage currentPath={context.url.pathname} />);
		},

		records(context) {
			return context.render(<RecordsPage currentPath={context.url.pathname} />, {
				headers: { "Cache-Control": "no-store" },
			});
		},

		slideOnly(context) {
			return context.render(<SlideOnlyPage currentPath={context.url.pathname} />);
		},

		async unitYear(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit);
			if (!unit) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 });
			}
			const year = context.params.year;
			const sections = await buildUnitExamSections(unit, year);
			if (sections.length === 0) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 });
			}
			return context.render(
				<UnitYearPage
					unit={unit}
					year={year}
					sections={sections}
					integratedTitle={getIntegratedTitle(unit, year)}
					currentPath={context.url.pathname}
				/>,
			);
		},

		async exam(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit);
			const examNumber = Number(context.params.exam);
			const year = context.params.year;
			const exam = unit
				? (await getExamByNumber(examNumber as never))?.exams[year as Year]
				: undefined;
			if (!(unit && exam)) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 });
			}
			return context.render(
				<ExamPlayerPage
					heading={`${unit.name} ${year}年度 小テスト${examNumber}`}
					description={exam.title}
					currentPath={context.url.pathname}
					player={{
						examId: exam.id,
						examNumber: examNumber as ExamNumber,
						year: year as Year,
						unitId: unit.id,
						playerTitle: unit.name,
						questions: exam.questions,
						mode: "exam",
					}}
				/>,
			);
		},

		async question(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit);
			const examNumber = Number(context.params.exam);
			const year = context.params.year;
			const exam = unit
				? (await getExamByNumber(examNumber as never))?.exams[year as Year]
				: undefined;
			const question = exam?.questions.find(
				(candidate) => candidate.id === context.params.question,
			);
			if (!(unit && exam && question)) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 });
			}
			return context.render(
				<ExamPlayerPage
					heading={`${unit.name} ${year}年度 問${question.number}`}
					description={exam.title}
					currentPath={context.url.pathname}
					player={{
						examId: exam.id,
						examNumber: examNumber as ExamNumber,
						year: year as Year,
						unitId: unit.id,
						playerTitle: unit.name,
						questions: exam.questions,
						mode: "question",
						requestedQuestionId: question.id,
					}}
				/>,
			);
		},

		health() {
			return Response.json({ status: "ok" });
		},

		llms() {
			return new Response(generateLlmsTxt(), {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "public, max-age=86400",
				},
			});
		},

		async llmsFull() {
			return new Response(await generateLlmsFullTxt(), {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "public, max-age=86400",
				},
			});
		},
	},
});
