/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { ExamSection } from "../../components/ExamSection";
import { Header } from "../../components/Header";
import { SlideSection } from "../../components/SlideSection";
import { getExamByNumber } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import type { ExamByYear, ExamNumber, Year } from "../../types";
import { YEARS } from "../../types";

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

const DEFAULT_YEAR = YEARS[0];

export default createRoute(async (c) => {
	const unitId = c.req.param("unit");
	const yearParam = c.req.param("year");

	const unit = unitBasedTabs.find((tab) => tab.id === unitId);
	const year = YEARS.find((y) => y === yearParam) as Year | undefined;
	const examMapping = unit && year ? unit.examMapping.find((m) => m.year === year) : undefined;

	if (!unit || !year || !examMapping) {
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
	const examDataList = loaded.filter(
		(item): item is { examNumber: ExamNumber; examByYear: ExamByYear } => !!item.examByYear,
	);

	const availableYears = unit.examMapping.map((m) => m.year);
	const totalQuestions = examDataList.reduce((sum, item) => {
		const exam = item.examByYear.exams[year];
		return sum + (exam?.questions?.length ?? 0);
	}, 0);

	// JSON-LD: Quiz + LearningResource
	const pageDescription = `明治大学 基本情報技術 I「${unit.name}」${year}年度の演習問題${totalQuestions > 0 ? `（全${totalQuestions}問）` : ""}。${unit.description}`;
	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Quiz",
				name: `${unit.name} - ${year}年度演習問題`,
				about: {
					"@type": "Thing",
					name: unit.name,
					description: unit.description,
				},
				educationalLevel: "大学学部",
				inLanguage: "ja",
				isPartOf: {
					"@type": "Course",
					name: "基本情報技術 I",
					provider: {
						"@type": "EducationalOrganization",
						name: "明治大学",
					},
				},
				...(totalQuestions > 0 ? { numberOfQuestions: totalQuestions } : {}),
			},
			{
				"@type": "LearningResource",
				name: `${unit.title} (${year}年度)`,
				description: pageDescription,
				learningResourceType: "Practice Problem",
				educationalLevel: "大学学部",
				inLanguage: "ja",
				teaches: unit.description,
			},
		],
	};

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="container mx-auto px-4 py-6 max-w-6xl">
					{/* 単元タブ */}
					<div
						class="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-2"
						role="tablist"
						aria-label="単元選択"
					>
						{unitBasedTabs.map((tab) => {
							const isActive = tab.id === unit.id;
							const targetYear = tab.examMapping[0]?.year ?? DEFAULT_YEAR;
							return (
								<a
									href={`/${tab.id}/${targetYear}`}
									role="tab"
									aria-selected={isActive ? "true" : "false"}
									class={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-center text-sm font-bold transition-all ${
										isActive
											? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm"
											: "border-gray-300 bg-white text-gray-700 hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
									}`}
								>
									{tab.name}
								</a>
							);
						})}
						<a
							href="/slide-only"
							class="min-h-10 shrink-0 rounded-full border border-gray-300 bg-white px-4 py-2 text-center text-sm font-bold text-gray-700 transition-all hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
						>
							講義資料のみ
						</a>
					</div>

					{/* コンテンツ */}
					<div class="soft-panel rounded-2xl p-4 sm:p-6">
						<section class="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-start">
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
									{unit.description}。まずは1問だけ選んで、正解でも不正解でも次の一歩にします。
								</p>
								<div class="mt-4 flex flex-wrap gap-2">
									<a
										href="#questions"
										class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1e3a5f] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2d4a6f]"
									>
										問題へ進む
									</a>
									<a
										href="#slides"
										class="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#1e3a5f]/20 bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] transition-colors hover:bg-[#e8eef5]"
									>
										先に資料を見る
									</a>
								</div>
							</div>

							<aside class="rounded-xl border border-[#e2e0dc] bg-[#faf9f7] p-4">
								<p class="text-sm font-bold text-[#1e3a5f]">このページの量</p>
								<div class="mt-3 grid grid-cols-2 gap-2">
									<div class="rounded-lg bg-white p-3 text-center">
										<div class="text-2xl font-bold text-[#1e3a5f]">{totalQuestions}</div>
										<div class="text-xs text-slate-500">問題</div>
									</div>
									<div class="rounded-lg bg-white p-3 text-center">
										<div class="text-2xl font-bold text-[#1e3a5f]">{examDataList.length}</div>
										<div class="text-xs text-slate-500">小テスト</div>
									</div>
								</div>
								<p class="mt-3 text-xs leading-5 text-slate-500">
									全部やる必要はありません。まず1問、次にもう1問のペースで進めます。
								</p>
							</aside>
						</section>

						{/* 講義スライド */}
						<div id="slides" class="scroll-mt-20">
							{unit.slides.length > 0 ? <SlideSection slides={unit.slides} /> : null}
						</div>

						{/* 年度選択 */}
						<div class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
							<p class="mb-2 text-sm font-bold text-[#1e3a5f]">年度を選択</p>
							<div class="flex flex-row flex-wrap gap-3">
								{YEARS.map((y) => {
									const isAvailable = availableYears.includes(y);
									const isSelected = y === year;
									return isAvailable ? (
										<a
											href={`/${unit.id}/${y}`}
											class={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
												isSelected
													? "border-[#c9a227] bg-[#f7eed1] text-[#6f5712]"
													: "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-gray-300"
											}`}
										>
											{y}年度
										</a>
									) : (
										<span class="cursor-not-allowed rounded-full border-2 border-gray-100 px-4 py-1.5 text-sm font-bold text-gray-300">
											{y}年度
										</span>
									);
								})}
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
												<span class="text-[11px] opacity-80">小テスト{item.examNumber}</span>
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
									<div id={`exam-${item.examNumber}`} class="scroll-mt-20">
										<ExamSection exam={exam} title={title} />
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</main>
		</>,
		{
			title: `${unit.title} (${year}年度) - 基本情報技術 I`,
			description: pageDescription,
			jsonLd,
		},
	);
});
