import type { QuestionLocationGroup } from "../../features/answer/continueLearningTypes";
import { unitBasedTabs } from "../units";
import { getExamByNumber, selectVisibleExamNumbers } from "./index";

export type HomeExamCatalog = Readonly<{
	examCounts: ReadonlyMap<string, number>;
	locationGroups: readonly QuestionLocationGroup[];
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
					locationGroups: candidates
						.filter(({ examNumber }) => visible.has(examNumber))
						.flatMap(({ exam }) => {
							const questionIds = (exam?.questions ?? []).map((question) => question.id);
							return questionIds.length > 0
								? [
										{
											unitName: unit.name,
											year: mapping.year,
											hrefPrefix: `/${unit.id}/${mapping.year}#question-`,
											questionIds,
										},
									]
								: [];
						}),
				};
			}),
		),
	);
	return {
		examCounts: new Map(catalogs.map(({ key, examCount }) => [key, examCount])),
		locationGroups: catalogs.flatMap((catalog) => catalog.locationGroups),
	};
}
