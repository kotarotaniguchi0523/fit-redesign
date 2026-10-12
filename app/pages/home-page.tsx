import type { Handle } from "remix/component";
import { css } from "remix/component";
import { unitBasedTabs } from "../data/units.ts";
import { ContinueLearning } from "../features/answer/ui/continue-learning.tsx";
import { routes } from "../routes.ts";
import { YEARS } from "../types/index.ts";
import { Document } from "./document.tsx";

const mainStyle = css({
	maxWidth: "72rem",
	margin: "0 auto",
	padding: "1rem 1rem 4rem",
});

const titleStyle = css({
	fontFamily: "var(--font-serif)",
	fontSize: "1.75rem",
	fontWeight: 700,
	color: "var(--color-primary)",
	margin: "0 0 0.5rem",
});

const ledeStyle = css({
	color: "var(--color-text-muted)",
	margin: "0 0 1.5rem",
});

const _accordionWrapStyle = css({
	display: "none",
	marginTop: "1rem",
	"@media (max-width: 40rem)": { display: "block" },
});

const tableOnlyStyle = css({
	"@media (max-width: 40rem)": { display: "none" },
});

const tableWrapStyle = css({
	overflowX: "auto",
	marginTop: "1.5rem",
});

const tableStyle = css({
	width: "100%",
	borderCollapse: "collapse",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "0.75rem",
	overflow: "hidden",
});

const cellStyle = css({
	borderTop: "1px solid var(--color-border)",
	padding: "0.625rem 0.75rem",
	textAlign: "left",
	fontSize: "0.875rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

export function HomePage(
	handle: Handle<{
		examCounts: ReadonlyMap<string, number>;
		locationGroups: ReadonlyArray<{
			unitName: string;
			year: string;
			hrefPrefix: string;
			questionIds: readonly string[];
		}>;
		currentPath?: string;
	}>,
) {
	return () => {
		const { examCounts, locationGroups, currentPath = "/" } = handle.props;
		const _accordionUnits = unitBasedTabs.map((unit) => ({
			id: unit.id,
			icon: unit.icon,
			name: unit.name,
			years: unit.examMapping.map((mapping) => mapping.year),
		}));

		const jsonLd = {
			"@context": "https://schema.org",
			"@graph": [
				{
					"@type": "WebSite",
					name: "基本情報技術 I - 明治大学",
					url: "https://fit-redesign.r02takako.workers.dev/",
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

		return (
			<Document
				title="問題を選ぶ - 基本情報技術 I"
				description="明治大学 基本情報技術 I の単元と年度を選び、小テストと解答・解説を確認できます。"
				jsonLd={jsonLd}
				currentPath={currentPath}
				canonicalPath="/"
			>
				<main id="main-content" mix={mainStyle}>
					<section>
						<h1 mix={titleStyle}>問題を選ぶ</h1>
						<p mix={ledeStyle}>単元を選び、確認したい年度を開いてください。</p>
					</section>

					<div mix={[tableWrapStyle, tableOnlyStyle]}>
						<table mix={tableStyle}>
							<thead>
								<tr>
									<th scope="col" mix={cellStyle}>
										単元
									</th>
									{YEARS.map((year) => (
										<th key={year} scope="col" mix={cellStyle}>
											{year}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{unitBasedTabs.map((unit, index) => (
									<tr key={unit.id}>
										<th scope="row" mix={cellStyle}>
											{index + 1}. {unit.name}
										</th>
										{YEARS.map((year) => {
											const mapping = unit.examMapping.find((item) => item.year === year);
											if (!mapping) {
												return (
													<td key={year} mix={cellStyle}>
														—
													</td>
												);
											}
											const count = examCounts.get(`${unit.id}|${year}`) ?? 1;
											return (
												<td key={year} mix={cellStyle}>
													<a mix={linkStyle} href={routes.unitYear.href({ unit: unit.id, year })}>
														{year}
														{count > 1 ? <small>（{count}テスト）</small> : null}
													</a>
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<ContinueLearning groups={locationGroups} />
				</main>
			</Document>
		);
	};
}
