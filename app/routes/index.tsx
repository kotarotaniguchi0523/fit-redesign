/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { getExamByNumber } from "../data/exams";
import { SITE_URL } from "../data/site";
import { unitBasedTabs } from "../data/units";
import ContinueLearning from "../features/answer/$ContinueLearning";
import { YEARS } from "../types";

export default createRoute(async (c) => {
	const examCounts = new Map<string, number>();
	await Promise.all(
		unitBasedTabs.flatMap((unit) =>
			unit.examMapping.map(async (mapping) => {
				const signatures = await Promise.all(
					mapping.examNumbers.map(async (examNumber) => {
						const exam = (await getExamByNumber(examNumber))?.exams[mapping.year];
						return exam?.questions.map((question) => question.id).join("|") ?? `exam-${examNumber}`;
					}),
				);
				examCounts.set(`${unit.id}|${mapping.year}`, new Set(signatures).size);
			}),
		),
	);
	const locations = (
		await Promise.all(
			unitBasedTabs.flatMap((unit) =>
				unit.examMapping.flatMap((mapping) =>
					mapping.examNumbers.map(async (examNumber) => {
						const exam = (await getExamByNumber(examNumber))?.exams[mapping.year];
						return (exam?.questions ?? []).map((question) => ({
							questionId: question.id,
							unitName: unit.name,
							year: mapping.year,
							href: `/${unit.id}/${mapping.year}#question-${question.id}`,
						}));
					}),
				),
			),
		)
	).flat();

	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				name: "基本情報技術 I - 明治大学",
				url: `${SITE_URL}/`,
				description: "単元と年度を選び、過去の小テストと解答・解説をすぐ確認できるサイト。",
				inLanguage: "ja",
			},
			{
				"@type": "Course",
				name: "基本情報技術 I",
				provider: { "@type": "EducationalOrganization", name: "明治大学" },
				inLanguage: "ja",
			},
		],
	};

	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");
	return c.render(
		<main id="main-content" class="study-shell">
			<div class="page-container">
				<section class="py-2">
					<h1 class="home-title">問題を選ぶ</h1>
					<p class="home-lede">単元を選び、確認したい年度を開いてください。</p>
				</section>

				<div class="exercises-mobile-list">
					{unitBasedTabs.map((unit, index) => (
						<details class="exercises-mobile-item">
							<summary>
								<span class="exercises-unit-num">{index + 1}</span>
								{unit.name}
							</summary>
							<div class="exercises-mobile-years">
								{unit.examMapping.map((mapping) => (
									<a href={`/${unit.id}/${mapping.year}`}>{mapping.year}年度</a>
								))}
							</div>
						</details>
					))}
				</div>

				<div class="exercises-table-wrap mt-6">
					<table class="exercises-table">
						<thead>
							<tr>
								<th scope="col" class="exercises-th-unit">
									単元
								</th>
								{YEARS.map((year) => (
									<th scope="col" class="exercises-th-year">
										{year}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{unitBasedTabs.map((unit, index) => (
								<tr>
									<th scope="row" class="exercises-td-unit">
										<span class="exercises-unit-num">{index + 1}</span>
										{unit.name}
									</th>
									{YEARS.map((year) => {
										const mapping = unit.examMapping.find((item) => item.year === year);
										return mapping ? (
											<td class="exercises-td">
												<a href={`/${unit.id}/${year}`} class="exercises-link">
													{year}
													<span class="sr-only">年度</span>
													{(examCounts.get(`${unit.id}|${year}`) ?? 1) > 1 ? (
														<small class="block">
															{examCounts.get(`${unit.id}|${year}`)}テスト
														</small>
													) : null}
												</a>
											</td>
										) : (
											<td class="exercises-td exercises-td-empty">—</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<ContinueLearning locations={locations} />
			</div>
		</main>,
		{
			title: "問題を選ぶ - 基本情報技術 I",
			description:
				"明治大学 基本情報技術 I の単元と年度を選び、小テストと解答・解説を確認できます。",
			jsonLd,
		},
	);
});
