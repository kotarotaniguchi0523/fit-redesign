/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx/jsx-runtime";
import { createRoute } from "honox/factory";
import { ExamSection } from "../../components/ExamSection";
import { Header } from "../../components/Header";
import { SlideSection } from "../../components/SlideSection";
import { getExamByNumber, selectVisibleExamNumbers } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import LapStopwatch from "../../features/timer/$LapStopwatch";
import type { ExamNumber, UnitBasedTab, Year } from "../../types";
import { isExamNumber, YEARS } from "../../types";

/**
 * 単元ページ（単元 × 年度 × 小テスト の演習）。
 *
 * SSG は使わず、Workers の SSR + エッジキャッシュで配信する。
 * - c.req.param("unit") / ("year") でパラメータを取得し、
 * - ?exam クエリで表示する単一小テストを絞り込む（不正値は先頭 exam にフォールバック）。
 * - loader（app/data/exams の getExamByNumber）から試験データを取得して描画。
 * - JSON-LD（Quiz / LearningResource）は c.render の props で _renderer.tsx に渡す。
 * - パラメータが既知の単元・年度に一致しなければ 404。
 *
 * Header / ExamSection は別エージェントが app/components/ に移植中（hono/jsx 版）。
 */

const DEFAULT_YEAR = YEARS[0];

// 年度ピルの単一エントリ
function YearPill({
	y,
	unitId,
	isAvailable,
	isSelected,
}: {
	y: Year;
	unitId: string;
	isAvailable: boolean;
	isSelected: boolean;
}): JSX.Element {
	if (isAvailable) {
		return (
			<a
				href={`/${unitId}/${y}`}
				class={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
					isSelected
						? "border-[#c9a227] bg-[#f7eed1] text-[#6f5712]"
						: "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-gray-300"
				}`}
			>
				{y}年度
			</a>
		);
	}
	return (
		<span class="cursor-not-allowed rounded-full border-2 border-gray-100 px-4 py-1.5 text-sm font-bold text-gray-300">
			{y}年度
		</span>
	);
}

// 小テスト切替タブ（複数 exam がある年度のみ描画）
function ExamSwitchTabs({
	examNumbers,
	selectedExamNumber,
	unitId,
	year,
}: {
	examNumbers: ExamNumber[];
	selectedExamNumber: ExamNumber;
	unitId: string;
	year: Year;
}): JSX.Element | null {
	if (examNumbers.length <= 1) {
		return null;
	}
	return (
		<div class="mt-4">
			<p class="mb-2 text-sm font-bold text-[#1e3a5f]">小テストを選択</p>
			<div class="flex flex-row flex-wrap gap-2" role="tablist" aria-label="小テスト選択">
				{examNumbers.map((examNum) => {
					const isActive = examNum === selectedExamNumber;
					return (
						<a
							href={`/${unitId}/${year}?exam=${examNum}`}
							role="tab"
							aria-selected={isActive ? "true" : "false"}
							class={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
								isActive
									? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm"
									: "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
							}`}
						>
							小テスト{examNum}
						</a>
					);
				})}
			</div>
		</div>
	);
}

// 単元タブ行（全単元のナビゲーション）
function UnitTabBar({ currentUnitId }: { currentUnitId: string }): JSX.Element {
	return (
		<div
			class="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-2"
			role="tablist"
			aria-label="単元選択"
		>
			{unitBasedTabs.map((tab) => {
				const isActive = tab.id === currentUnitId;
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
	);
}

// ?exam クエリから選択中の小テスト番号を決定する。
// examNumbers に含まれない値（不正・undefined→NaN）は find が弾き、先頭にフォールバック（404 にしない）。
function resolveSelectedExamNumber(
	examQueryRaw: string | undefined,
	examNumbers: ExamNumber[],
): ExamNumber {
	const examQueryNumber = Number(examQueryRaw);
	return examNumbers.find((examNum) => examNum === examQueryNumber) ?? examNumbers[0];
}

export default createRoute(async (c) => {
	const unitId = c.req.param("unit");
	const yearParam = c.req.param("year");

	const unitIndex = unitBasedTabs.findIndex((tab) => tab.id === unitId);
	const unit = unitBasedTabs[unitIndex];
	const year = YEARS.find((y) => y === yearParam) as Year | undefined;
	const examMapping = unit && year ? unit.examMapping.find((m) => m.year === year) : undefined;

	if (!(unit && year && examMapping)) {
		return c.notFound();
	}

	const unitNumber = unitIndex + 1;
	// examMapping の examNumbers は dashboardAggregator の questionToUnitMap にも使われるため変更しない。
	// 表示用には visibleExamNumbers を使い、問題集合が他候補の部分集合になる exam をタブから除外する。
	const allCandidateExamNumbers = examMapping.examNumbers;

	// 候補 exam を全件ロードして問題 ID を取得（import.meta.glob で eager 読み込み済みのためメモリアクセスのみ）。
	const candidateExamEntries = await Promise.all(
		allCandidateExamNumbers.map(async (examNumber) => ({
			examNumber,
			examByYear: await getExamByNumber(examNumber),
		})),
	);
	// 問題集合が他候補の部分集合になる exam を除外した表示用 examNumber 配列。
	// selectVisibleExamNumbers は number[] を返すが、入力が ExamNumber[] 由来のため isExamNumber で絞って ExamNumber[] に変換する。
	const visibleExamNumbers: ExamNumber[] = selectVisibleExamNumbers(
		candidateExamEntries.map(({ examNumber, examByYear: examData }) => ({
			examNumber,
			questionIds: examData?.exams[year]?.questions.map((question) => question.id) ?? [],
		})),
	).flatMap((examNumber) => (isExamNumber(examNumber) ? [examNumber] : []));

	// ?exam クエリで表示する小テストを絞り込む（dedup で消えた番号は先頭 visible にフォールバック）。
	const selectedExamNumber = resolveSelectedExamNumber(c.req.query("exam"), visibleExamNumbers);

	// 選択中 exam のデータ（全件ロード済みエントリから取得）。
	const selectedExamEntry = candidateExamEntries.find(
		(entry) => entry.examNumber === selectedExamNumber,
	);

	const availableYears = unit.examMapping.map((m) => m.year);

	// 選択中 exam の問題（5問）を取得。
	const selectedExam = selectedExamEntry?.examByYear?.exams[year];
	const totalQuestions = selectedExam?.questions.length ?? 0;

	// ラップ式ストップウォッチに渡す questionId 配列（QuestionId は string のブランド型）。
	const questionIds: string[] = selectedExam?.questions.map((question) => question.id) ?? [];

	// exam ごとの識別子ラベル。単一 visible exam 年度は曖昧さが無いので空（title/description/JSON-LD で一貫して省略）。
	const examLabel = visibleExamNumbers.length > 1 ? `小テスト${selectedExamNumber}` : "";

	// JSON-LD: Quiz + LearningResource（表示中 exam の問題数に追従）
	const pageDescription = buildPageDescription(unit, year, examLabel, totalQuestions);
	const jsonLd = buildJsonLd(unit, year, examLabel, totalQuestions, pageDescription);

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	const pageTitle = buildPageTitle(unit, year, examLabel);

	// 複数 visible exam 年度は各 exam が独立した self-referencing canonical（?exam={N} 追従）。単一 exam 年度はクエリ無し。
	const canonicalPath =
		visibleExamNumbers.length > 1 ? `${c.req.path}?exam=${selectedExamNumber}` : c.req.path;

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="container mx-auto px-4 py-6 max-w-6xl">
					<UnitTabBar currentUnitId={unit.id} />

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
										<div class="text-2xl font-bold text-[#1e3a5f]">1</div>
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

						{/* 小テスト切替タブ（複数 visible exam がある年度のみ表示・dedup 後） */}
						<ExamSwitchTabs
							examNumbers={visibleExamNumbers}
							selectedExamNumber={selectedExamNumber}
							unitId={unit.id}
							year={year}
						/>

						{/* 小テスト本体 */}
						<div id="questions" class="scroll-mt-20">
							{selectedExamEntry?.examByYear ? (
								<ExamSection
									exam={selectedExam}
									title={selectedExam?.title ?? selectedExamEntry.examByYear.title}
								/>
							) : null}
						</div>
					</div>
				</div>
			</main>
			{/* ラップ式ストップウォッチ island（フローティング固定 UI）。1ページ = 1 exam = 1本 */}
			{questionIds.length > 0 ? <LapStopwatch questionIds={questionIds} /> : null}
		</>,
		{
			title: pageTitle,
			description: pageDescription,
			jsonLd,
			canonical: canonicalPath,
		},
	);
});

// exam ラベルの接頭スペース付き断片（空ラベル＝単一 exam 年度なら何も付けない）。
function examPartOf(examLabel: string): string {
	return examLabel ? ` ${examLabel}` : "";
}

// ページタイトルを生成する（複数 exam がある年度のみ exam 番号を付ける）
function buildPageTitle(unit: UnitBasedTab, year: Year, examLabel: string): string {
	return `${unit.title} (${year}年度)${examPartOf(examLabel)} - 基本情報技術 I`;
}

// ページ説明文を生成する
function buildPageDescription(
	unit: UnitBasedTab,
	year: Year,
	examLabel: string,
	totalQuestions: number,
): string {
	const questionText = totalQuestions > 0 ? `（全${totalQuestions}問）` : "";
	return `明治大学 基本情報技術 I「${unit.name}」${year}年度${examPartOf(examLabel)}の演習問題${questionText}。${unit.description}`;
}

// JSON-LD スキーマを生成する
function buildJsonLd(
	unit: UnitBasedTab,
	year: Year,
	examLabel: string,
	totalQuestions: number,
	pageDescription: string,
): Record<string, unknown> {
	const examPart = examPartOf(examLabel);
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Quiz",
				name: `${unit.name} - ${year}年度演習問題${examPart}`,
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
				name: `${unit.title} (${year}年度)${examPart}`,
				description: pageDescription,
				learningResourceType: "Practice Problem",
				educationalLevel: "大学学部",
				inLanguage: "ja",
				teaches: unit.description,
			},
		],
	};
}
