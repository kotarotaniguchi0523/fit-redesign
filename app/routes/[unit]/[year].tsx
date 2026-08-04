/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { ExamSection } from "../../components/ExamSection";
import { getExamByNumber, selectVisibleExamNumbers } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import type { ExamByYear, ExamNumber } from "../../types";
import { isYear } from "../../types";
import { buildJsonLd, buildPageDescription, buildPageTitle } from "./_meta";
import { StudyNavigator } from "./_unitNav";

/**
 * 単元ページ（単元 × 年度の演習）。
 *
 * SSG は使わず、Workers の SSR + エッジキャッシュで配信する。
 * - c.req.param("unit") / ("year") でパラメータを取得し、
 * - loader（app/data/exams の getExamByNumber）から試験データを取得して描画。
 * - JSON-LD（Quiz / LearningResource）は c.render の props で _renderer.tsx に渡す。
 * - パラメータが既知の単元・年度に一致しなければ 404。
 *
 */

export default createRoute(async (c) => {
	const unitId = c.req.param("unit");
	const yearParam = c.req.param("year");

	const unit = unitBasedTabs.find((tab) => tab.id === unitId);
	const year = yearParam && isYear(yearParam) ? yearParam : undefined;
	const examMapping = unit && year ? unit.examMapping.find((m) => m.year === year) : undefined;

	if (!(unit && year && examMapping)) {
		return c.notFound();
	}

	const examNumbers = examMapping.examNumbers;

	// 各試験のデータを取得（loader 経由）
	const loaded = await Promise.all(
		examNumbers.map(async (examNumber) => {
			const examByYear = await getExamByNumber(examNumber);
			return { examNumber, examByYear };
		}),
	);
	const availableExamData = loaded.filter(
		(item): item is { examNumber: ExamNumber; examByYear: ExamByYear } => !!item.examByYear,
	);
	// 統合試験には、別番号の試験を丸ごと内包するものがある。
	// 完全一致だけでなく真部分集合も除外し、問題カードと DOM ID の重複を防ぐ。
	const visibleExamNumbers = new Set(
		selectVisibleExamNumbers(
			availableExamData.map((item) => ({
				examNumber: item.examNumber,
				questionIds: (item.examByYear.exams[year]?.questions ?? []).map((question) => question.id),
			})),
		),
	);
	const examDataList = availableExamData.filter((item) => visibleExamNumbers.has(item.examNumber));

	const totalQuestions = examDataList.reduce((sum, item) => {
		const exam = item.examByYear.exams[year];
		return sum + (exam?.questions?.length ?? 0);
	}, 0);

	const pageDescription = buildPageDescription(unit, year, "", totalQuestions);
	const jsonLd = buildJsonLd(unit, year, "", totalQuestions, pageDescription);

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container page-container--wide">
				<a href="/" class="page-backlink">
					← 問題一覧
				</a>
				<StudyNavigator currentUnitId={unit.id} currentYear={year} />

				<div class="content-panel">
					<header class="border-b border-slate-200 pb-4">
						<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<h1
								class="text-2xl font-bold text-[#1e3a5f] sm:text-3xl"
								style="font-family: var(--font-serif)"
							>
								{unit.title}
							</h1>
							<span class="text-sm font-bold text-[#6f5712]">{year}年度</span>
						</div>
						<p class="mt-2 text-sm text-slate-600">{unit.description}</p>
					</header>

					{/* 小テスト切り替え（複数ある場合） */}
					{examDataList.length > 1 ? (
						<nav class="mt-4" aria-label="小テスト選択">
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{examDataList.map((item) => {
									const exam = item.examByYear.exams[year];
									const title = exam?.title ?? item.examByYear.title ?? "";
									return (
										<a
											href={`#exam-${item.examNumber}`}
											class="lift-card flex min-h-11 w-full flex-col justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-xs font-bold text-gray-700 transition-all hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
										>
											<span class="text-sm leading-snug break-words w-full">
												小テスト{item.examNumber} — {title}
											</span>
										</a>
									);
								})}
							</div>
						</nav>
					) : null}

					{/* 各小テスト */}
					<div id="questions" class="scroll-mt-20">
						{examDataList.map((item) => {
							const exam = item.examByYear.exams[year];
							const title = exam?.title ?? item.examByYear.title ?? "";
							return (
								<ExamSection
									exam={exam}
									title={title}
									examNumber={item.examNumber}
									unitId={unit.id}
									showExamLabel={examDataList.length > 1}
								/>
							);
						})}
					</div>
				</div>
			</div>
		</main>,
		{
			title: buildPageTitle(unit, year, ""),
			description: pageDescription,
			jsonLd,
		},
	);
});
