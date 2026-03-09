import type { APIRoute } from "astro";
import { getExamByNumber } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import type { Year } from "../types/index";

export const prerender = true;

export const GET: APIRoute = async () => {
	const lines: string[] = [
		"# 基本情報技術 I - 明治大学 演習問題サイト（完全版）",
		"",
		"> 明治大学の「基本情報技術 I」講義の演習問題を全て収録。2013〜2017年度の小テスト問題と解答・解説を単元別に整理。",
		"",
		"---",
		"",
	];

	for (const unit of unitBasedTabs) {
		lines.push(`# ${unit.title}`);
		lines.push("");
		lines.push(`${unit.description}`);
		lines.push("");

		for (const mapping of unit.examMapping) {
			const year = mapping.year as Year;

			for (const examNum of mapping.examNumbers) {
				const examByYear = await getExamByNumber(examNum);
				if (!examByYear) continue;

				const exam = examByYear.exams[year];
				if (!exam) continue;

				lines.push(`## ${unit.name} - ${year}年度: ${exam.title}`);
				lines.push("");

				for (const question of exam.questions) {
					lines.push(`### 問題 ${question.number}`);
					lines.push("");
					lines.push(question.text);
					lines.push("");

					if (question.options && question.options.length > 0) {
						for (const option of question.options) {
							lines.push(`- **${option.label}**: ${option.value}`);
						}
						lines.push("");
					}

					lines.push(`**解答:** ${question.answer}`);

					if (question.explanation) {
						lines.push("");
						lines.push(`**解説:** ${question.explanation}`);
					}

					lines.push("");
					lines.push("---");
					lines.push("");
				}
			}
		}
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
