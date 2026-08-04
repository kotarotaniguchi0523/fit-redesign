import { unitBasedTabs } from "../units";
import { getExamByNumber, selectVisibleExamNumbers } from "./index";

export type QuestionLocation = Readonly<{
	questionId: string;
	unitName: string;
	year: string;
	href: string;
}>;

export type HomeExamCatalog = Readonly<{
	examCounts: ReadonlyMap<string, number>;
	locations: readonly QuestionLocation[];
}>;

export async function loadHomeExamCatalog(): Promise<HomeExamCatalog> {
	const catalogs = await Promise.all(
		unitBasedTabs.flatMap((unit) =>
			unit.examMapping.map(async (mapping) => {
				const candidates = await Promise.all(
					mapping.examNumbers.map(async (examNumber) => ({
						examNumber,
						exam: (await getExamByNumber(examNumber))?.exams[mapping.year],
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
				return {
					key: `${unit.id}|${mapping.year}`,
					examCount: visible.size,
					locations: candidates
						.filter(({ examNumber }) => visible.has(examNumber))
						.flatMap(({ exam }) =>
							(exam?.questions ?? []).map((question) => ({
								questionId: question.id,
								unitName: unit.name,
								year: mapping.year,
								href: `/${unit.id}/${mapping.year}#question-${question.id}`,
							})),
						),
				};
			}),
		),
	);
	return {
		examCounts: new Map(catalogs.map(({ key, examCount }) => [key, examCount])),
		locations: catalogs.flatMap((catalog) => catalog.locations),
	};
}
