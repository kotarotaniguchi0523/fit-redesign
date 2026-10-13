import type { Handle } from "remix/component";
import { css, Frame } from "remix/component";

import { getExamByNumber, selectVisibleExamNumbers } from "../data/exams/index.ts";
import { routes } from "../routes.ts";
import type { UnitBasedTab, Year } from "../types/index.ts";
import { PageHeading } from "../ui/page-heading.tsx";
import { Document } from "./document.tsx";
import { type ExamSection, ExamSections } from "./exam-sections.tsx";

const mainStyle = css({
	maxWidth: "52rem",
	margin: "0 auto",
	padding: "1rem 1rem 4rem",
});

/**
 * 単元・年度ページ。小テスト一覧は `/:unit/:year/region` を指す `<Frame>` として描画し、
 * 一覧を独立したルート所有の領域として扱う。
 */
export function UnitYearPage(
	handle: Handle<{
		unit: UnitBasedTab;
		year: string;
		sections: readonly ExamSection[];
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
					<Frame
						name="exams"
						src={routes.unitYearRegion.href({ unit: unit.id, year })}
						fallback={<ExamSections unitId={unit.id} year={year} sections={sections} />}
					/>
				</main>
			</Document>
		);
	};
}

/** 単元・年度から表示すべき小テストの一覧を組み立てる。 */
export async function buildUnitExamSections(
	unit: UnitBasedTab,
	year: string,
): Promise<ExamSection[]> {
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
