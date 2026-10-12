import type { Handle } from "remix/component";
import { css } from "remix/component";

import { getExamByNumber, selectVisibleExamNumbers } from "../data/exams/index.ts";
import { routes } from "../routes.ts";
import type { UnitBasedTab, Year } from "../types/index.ts";
import { PageHeading } from "../ui/PageHeading.tsx";
import { Document } from "./document.tsx";

const mainStyle = css({
	maxWidth: "52rem",
	margin: "0 auto",
	padding: "1rem 1rem 4rem",
});

const sectionStyle = css({
	marginTop: "1.5rem",
	background: "var(--color-bg-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "0.75rem",
	padding: "1rem 1.25rem",
});

const sectionTitleStyle = css({
	fontSize: "1.05rem",
	fontWeight: 700,
	color: "var(--color-primary)",
	margin: "0 0 0.5rem",
});

const listStyle = css({
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "grid",
	gap: "0.25rem",
});

const linkStyle = css({
	color: "var(--color-primary)",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

export interface UnitExamSection {
	examNumber: number;
	title: string;
	questions: ReadonlyArray<{ id: string; number: number; text: string }>;
}

export function UnitYearPage(
	handle: Handle<{
		unit: UnitBasedTab;
		year: string;
		sections: readonly UnitExamSection[];
		integratedTitle?: string;
		currentPath: string;
	}>,
) {
	return () => {
		const { unit, year, sections, integratedTitle, currentPath } = handle.props;

		return (
			<Document
				title={`${unit.name} ${year}年度 - 基本情報技術 I`}
				description={`${unit.name} の ${year} 年度の小テスト一覧です。`}
				currentPath={currentPath}
			>
				<main id="main-content" mix={mainStyle}>
					<PageHeading
						eyebrow={`${year}年度`}
						title={unit.name}
						description={integratedTitle ?? unit.description}
					/>
					{sections.map((section) => (
						<section key={section.examNumber} mix={sectionStyle}>
							<h2 mix={sectionTitleStyle}>
								小テスト{section.examNumber}: {section.title}
							</h2>
							<ul mix={listStyle}>
								{section.questions.map((question) => (
									<li key={question.id}>
										<a
											mix={linkStyle}
											href={routes.question.href({
												unit: unit.id,
												year,
												exam: String(section.examNumber),
												question: question.id,
											})}
										>
											問{question.number}
										</a>
									</li>
								))}
							</ul>
						</section>
					))}
				</main>
			</Document>
		);
	};
}

/** 単元・年度から表示すべき小テストの一覧を組み立てる。 */
export async function buildUnitExamSections(
	unit: UnitBasedTab,
	year: string,
): Promise<UnitExamSection[]> {
	const mapping = unit.examMapping.find((item) => item.year === year);
	if (!mapping) {
		return [];
	}

	const candidates = await Promise.all(
		mapping.examNumbers.map(async (examNumber) => ({
			examNumber,
			exam: (await getExamByNumber(examNumber))?.exams[year as Year],
		})),
	);

	const visible = new Set(
		selectVisibleExamNumbers(
			candidates.map(({ examNumber, exam }) => ({
				examNumber,
				questionIds: (exam?.questions ?? []).map((question) => question.id),
			})),
		),
	);

	return candidates
		.filter(({ examNumber }) => visible.has(examNumber))
		.map(({ examNumber, exam }) => ({
			examNumber,
			title: exam?.title ?? "",
			questions: (exam?.questions ?? []).map((question) => ({
				id: question.id,
				number: question.number,
				text: question.text,
			})),
		}));
}

export function getIntegratedTitle(unit: UnitBasedTab, year: string): string | undefined {
	return unit.examMapping.find((item) => item.year === year)?.integratedTitle;
}
