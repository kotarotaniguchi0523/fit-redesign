import type { APIContext } from "astro";
import { getExamByNumber } from "../../../data/exams";
import { unitBasedTabs } from "../../../data/units";
import type { ExamNumber, Year } from "../../../types/index";

export const prerender = false;

/**
 * Markdown エンドポイント: AI エージェント向けにクリーンなMarkdownでコンテンツを提供
 * GET /api/markdown/unit-base-conversion/2013 → Markdown形式で問題と解答を返却
 * GET /api/markdown/ → サイト全体の概要をMarkdownで返却
 */
export async function GET(context: APIContext) {
	const path = context.params.path ?? "";

	// サイト概要
	if (!path || path === "/") {
		return markdownResponse(generateSiteOverview());
	}

	// 単元ページ: unit-xxx/yyyy
	const match = path.match(/^(unit-[a-z-]+)\/(\d{4})$/);
	if (!match) {
		return new Response("Not Found", { status: 404 });
	}

	const [, unitId, yearStr] = match;
	const unit = unitBasedTabs.find((t) => t.id === unitId);
	if (!unit) {
		return new Response("Unit not found", { status: 404 });
	}

	const year = yearStr as Year;
	const examMapping = unit.examMapping.find((m) => m.year === year);
	if (!examMapping) {
		return new Response("Year not available for this unit", { status: 404 });
	}

	const markdown = await generateUnitMarkdown(unit, year, examMapping.examNumbers);
	return markdownResponse(markdown);
}

function markdownResponse(content: string): Response {
	return new Response(content, {
		status: 200,
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
}

function generateSiteOverview(): string {
	const lines: string[] = [
		"# 基本情報技術 I - 明治大学 演習問題サイト",
		"",
		"明治大学の「基本情報技術 I」講義の演習問題を単元別・年度別に整理したサイトです。",
		"2013〜2017年度の小テスト問題を掲載しています。",
		"",
		"## 単元一覧",
		"",
		"| 単元 | 概要 | 年度 |",
		"|------|------|------|",
	];

	for (const unit of unitBasedTabs) {
		const years = unit.examMapping.map((m) => m.year).join(", ");
		lines.push(`| ${unit.name} | ${unit.description} | ${years} |`);
	}

	lines.push("");
	lines.push("## エンドポイント");
	lines.push("");
	lines.push("各単元の問題と解答をMarkdownで取得:");
	lines.push("");

	for (const unit of unitBasedTabs) {
		for (const mapping of unit.examMapping) {
			lines.push(
				`- \`/api/markdown/${unit.id}/${mapping.year}\` - ${unit.name} (${mapping.year}年度)`,
			);
		}
	}

	return lines.join("\n");
}

async function generateUnitMarkdown(
	unit: (typeof unitBasedTabs)[number],
	year: Year,
	examNumbers: ExamNumber[],
): Promise<string> {
	const lines: string[] = [
		`# ${unit.title} (${year}年度)`,
		"",
		`> ${unit.description}`,
		"",
		`- 講義: 基本情報技術 I（明治大学）`,
		`- 単元: ${unit.name}`,
		`- 年度: ${year}`,
		"",
	];

	for (const examNum of examNumbers) {
		const examByYear = await getExamByNumber(examNum);
		if (!examByYear) continue;

		const exam = examByYear.exams[year];
		if (!exam) continue;

		lines.push(`## ${exam.title}`);
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

			if (question.figureDescription) {
				lines.push(`*図: ${question.figureDescription}*`);
				lines.push("");
			}

			lines.push(`**解答:** ${question.answer}`);
			lines.push("");

			if (question.explanation) {
				lines.push(`**解説:** ${question.explanation}`);
				lines.push("");
			}

			lines.push("---");
			lines.push("");
		}
	}

	return lines.join("\n");
}
