import { createRoute } from "honox/factory";
import { getExamByNumber } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import type { ExamNumber, Question, Year } from "../types";

function questionLines(question: Question): string[] {
	const options = question.options ?? [];
	const optionLines =
		options.length > 0
			? [...options.map((option) => `- **${option.label}**: ${option.value}`), ""]
			: [];
	const explanationLines = question.explanation ? ["", `**解説:** ${question.explanation}`] : [];

	return [
		`### 問題 ${question.number}`,
		"",
		question.text,
		"",
		...optionLines,
		`**解答:** ${question.answer}`,
		...explanationLines,
		"",
		"---",
		"",
	];
}

async function examLines(unitName: string, year: Year, examNum: ExamNumber): Promise<string[]> {
	const examByYear = await getExamByNumber(examNum);
	const exam = examByYear?.exams[year];
	if (!exam) {
		return [];
	}

	return [
		`## ${unitName} - ${year}年度: ${exam.title}`,
		"",
		...exam.questions.flatMap(questionLines),
	];
}

async function unitLines(unit: (typeof unitBasedTabs)[number]): Promise<string[]> {
	const nestedExamLines = await Promise.all(
		unit.examMapping.flatMap((mapping) =>
			mapping.examNumbers.map((examNum) => examLines(unit.name, mapping.year as Year, examNum)),
		),
	);

	return [`# ${unit.title}`, "", `${unit.description}`, "", ...nestedExamLines.flat()];
}

/**
 * AI エージェント向け全問題 Markdown。
 * SSR + Cache-Control でエッジキャッシュ。
 */
export default createRoute(async (c) => {
	const nestedUnitLines = await Promise.all(unitBasedTabs.map(unitLines));
	const lines = [
		"# 基本情報技術 I - 明治大学 演習問題サイト（完全版）",
		"",
		"> 明治大学の「基本情報技術 I」講義の演習問題を全て収録。2013〜2017年度の小テスト問題と解答・解説を単元別に整理。",
		"",
		"---",
		"",
		...nestedUnitLines.flat(),
	];

	c.header("Content-Type", "text/plain; charset=utf-8");
	c.header("Cache-Control", "public, max-age=86400");
	return c.body(lines.join("\n"));
});
