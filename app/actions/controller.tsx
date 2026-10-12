import { createController } from 'remix/router'

import { getExamByNumber } from '../data/exams/index.ts'
import { loadHomeExamCatalog } from '../data/exams/homeCatalog.ts'
import { unitBasedTabs } from '../data/units.ts'
import type { Year } from '../types/index.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'
import { NotFoundPage } from './not-found-page.tsx'
import { PlaceholderPage } from './placeholder-page.tsx'
import { QuestionPage } from './question-page.tsx'
import {
	buildUnitExamSections,
	getIntegratedTitle,
	UnitYearPage,
} from './unit-year-page.tsx'

/**
 * ルートコントローラー。`routes.ts` の直下のルートリーフを担当する。
 * 入れ子のルートマップ（markdown / progress）は別コントローラーが持つ。
 */
export default createController(routes, {
	actions: {
		async home(context) {
			const { examCounts } = await loadHomeExamCatalog()
			return context.render(
				<HomePage examCounts={examCounts} currentPath={context.url.pathname} />,
				{ headers: { 'Cache-Control': 'public, s-maxage=31536000, max-age=3600' } },
			)
		},

		guide(context) {
			return context.render(
				<PlaceholderPage title="利用ガイド" currentPath={context.url.pathname} />,
			)
		},

		records(context) {
			return context.render(
				<PlaceholderPage title="学習記録" currentPath={context.url.pathname} />,
			)
		},

		slideOnly(context) {
			return context.render(
				<PlaceholderPage title="講義スライド" currentPath={context.url.pathname} />,
			)
		},

		async unitYear(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit)
			if (!unit) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 })
			}
			const year = context.params.year
			const sections = await buildUnitExamSections(unit, year)
			if (sections.length === 0) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 })
			}
			return context.render(
				<UnitYearPage
					unit={unit}
					year={year}
					sections={sections}
					integratedTitle={getIntegratedTitle(unit, year)}
					currentPath={context.url.pathname}
				/>,
			)
		},

		async exam(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit)
			const examNumber = Number(context.params.exam)
			const year = context.params.year
			const exam = unit ? (await getExamByNumber(examNumber as never))?.exams[year as Year] : undefined
			if (!unit || !exam) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 })
			}
			return context.render(
				<UnitYearPage
					unit={unit}
					year={year}
					sections={[
						{
							examNumber,
							title: exam.title,
							questions: exam.questions.map((question) => ({
								id: question.id,
								number: question.number,
								text: question.text,
							})),
						},
					]}
					currentPath={context.url.pathname}
				/>,
			)
		},

		async question(context) {
			const unit = unitBasedTabs.find((candidate) => candidate.id === context.params.unit)
			const examNumber = Number(context.params.exam)
			const year = context.params.year
			const exam = unit ? (await getExamByNumber(examNumber as never))?.exams[year as Year] : undefined
			const question = exam?.questions.find(
				(candidate) => candidate.id === context.params.question,
			)
			if (!unit || !exam || !question) {
				return context.render(<NotFoundPage path={context.url.pathname} />, { status: 404 })
			}
			return context.render(
				<QuestionPage
					unitName={unit.name}
					unitId={unit.id}
					year={year}
					examNumber={examNumber}
					examTitle={exam.title}
					question={question}
					currentPath={context.url.pathname}
				/>,
			)
		},

		health() {
			return Response.json({ status: 'ok' })
		},

		llms() {
			return new Response('llms.txt placeholder', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			})
		},

		llmsFull() {
			return new Response('llms-full.txt placeholder', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			})
		},
	},
})
