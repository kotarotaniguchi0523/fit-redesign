/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { ExamSection } from "../../components/ExamSection";
import { Header } from "../../components/Header";
import { getExamByNumber } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import type { ExamByYear, ExamNumber } from "../../types";
import { isYear, YEARS } from "../../types";
import { buildJsonLd, buildPageDescription, buildPageTitle } from "./_meta";
import { UnitTabBar, YearPill } from "./_unitNav";

/**
 * 単元ページ（単元 × 年度の演習）。
 *
 * SSG は使わず、Workers の SSR + エッジキャッシュで配信する。
 * - c.req.param("unit") / ("year") でパラメータを取得し、
 * - loader（app/data/exams の getExamByNumber）から試験データを取得して描画。
 * - JSON-LD（Quiz / LearningResource）は c.render の props で _renderer.tsx に渡す。
 * - パラメータが既知の単元・年度に一致しなければ 404。
 *
 * Header / ExamSection は別エージェントが app/components/ に移植中（hono/jsx 版）。
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

	const unitNumber = unitBasedTabs.findIndex((tab) => tab.id === unit.id) + 1;
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
	// 一部の単元マッピングには、同じ問題データを指す別番号が含まれる。
	// 問題IDの組が同じ小テストは二重表示せず、問題ID自身と番号が一致する方を採用する。
	const uniqueExams = new Map<string, (typeof availableExamData)[number]>();
	for (const item of availableExamData) {
		const questions = item.examByYear.exams[year]?.questions ?? [];
		const signature =
			questions.map((question) => question.id).join("|") || `exam-${item.examNumber}`;
		const current = uniqueExams.get(signature);
		const matchesOwnIds = questions.some((question) =>
			question.id.startsWith(`exam${item.examNumber}-${year}-`),
		);
		if (!current || matchesOwnIds) {
			uniqueExams.set(signature, item);
		}
	}
	const examDataList = [...uniqueExams.values()];

	const availableYears = unit.examMapping.map((m) => m.year);
	const totalQuestions = examDataList.reduce((sum, item) => {
		const exam = item.examByYear.exams[year];
		return sum + (exam?.questions?.length ?? 0);
	}, 0);

	const pageDescription = buildPageDescription(unit, year, "", totalQuestions);
	const jsonLd = buildJsonLd(unit, year, "", totalQuestions, pageDescription);

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="container mx-auto px-4 py-6 max-w-6xl">
					<UnitTabBar currentUnitId={unit.id} />

					{/* コンテンツ */}
					<div class="soft-panel rounded-2xl p-4 sm:p-6">
						<section>
							<div>
								<div class="flex items-center gap-3">
									<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8eef5] text-base font-black text-[#1e3a5f]">
										{unitNumber}
									</span>
									<div>
										<p class="text-sm font-bold text-[#c9a227]">今の単元</p>
										<h1
											class="text-2xl font-bold text-[#1e3a5f] sm:text-3xl"
											style="font-family: var(--font-serif)"
										>
											{unit.title}
										</h1>
									</div>
								</div>
								<p class="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
									{unit.description}
								</p>
								<div class="mt-4 flex flex-wrap gap-2">
									<a
										href="#questions"
										class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2d4a6f]"
									>
										問題へ進む
									</a>
									<a
										href="/slide-only"
										class="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#1e3a5f]/20 bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] transition-colors hover:bg-[#e8eef5]"
									>
										講義資料を見る
									</a>
								</div>
							</div>
						</section>

						{/* 年度選択 */}
						<div class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
							<p class="mb-2 text-sm font-bold text-[#1e3a5f]">年度を選択</p>
							<div class="flex flex-row flex-wrap gap-3">
								{YEARS.map((y) => (
									<YearPill
										y={y}
										unitId={unit.id}
										isAvailable={availableYears.includes(y)}
										isSelected={y === year}
									/>
								))}
							</div>
						</div>

						{/* 統合試験の注意表示 */}
						{examMapping.integratedTitle ? (
							<div class="mt-4 bg-blue-50 border border-blue-200 shadow-sm rounded-lg p-3">
								<div class="flex items-start gap-2">
									<div class="text-blue-600 font-medium mt-0.5">ℹ️</div>
									<div class="flex-1">
										<p class="text-sm text-blue-800">
											<span class="font-semibold">注意:</span> この年度では
											<span class="font-semibold">「{examMapping.integratedTitle}」</span>
											として統合試験になっています。
										</p>
									</div>
								</div>
							</div>
						) : null}

						{/* 小テスト切り替え（複数ある場合） */}
						{examDataList.length > 1 ? (
							<div class="mt-4">
								<p class="mb-2 text-sm font-bold text-[#1e3a5f]">小テスト一覧</p>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{examDataList.map((item) => {
										const exam = item.examByYear.exams[year];
										const title = exam?.title ?? item.examByYear.title ?? "";
										return (
											<a
												href={`#exam-${item.examNumber}`}
												class="lift-card flex w-full flex-col rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-xs font-bold text-gray-700 transition-all hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
											>
												<span class="text-[11px] opacity-80">
													小テスト{item.examNumber}・{exam?.questions.length ?? 0}問
												</span>
												<span class="text-sm leading-snug break-words w-full">{title}</span>
											</a>
										);
									})}
								</div>
							</div>
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
									/>
								);
							})}
						</div>
					</div>
				</div>
			</main>
		</>,
		{
			title: buildPageTitle(unit, year, ""),
			description: pageDescription,
			jsonLd,
		},
	);
});
