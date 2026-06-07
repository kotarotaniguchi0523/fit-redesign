import { getExamByNumber } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import type { ExamNumber, Year } from "../../types/index";

/**
 * AI エージェント向け Markdown コンテンツ生成（純粋ロジック）。
 * Hono ルート（/api/markdown/*）から呼ばれ、Response 生成は呼び出し側が担う。
 */

export interface MarkdownResult {
	status: number;
	body: string;
}

const MARKDOWN_PATH_RE = /^(unit-[a-z-]+)\/(\d{4})$/;

/**
 * パス（例 "unit-base-conversion/2013" / "" / "/"）から Markdown を解決する。
 * - 空 or "/" → サイト概要
 * - unit-xxx/yyyy → 単元 Markdown
 * - それ以外 / 未知の単元・年度 → 404
 */
export async function renderMarkdown(path: string): Promise<MarkdownResult> {
	if (!path || path === "/") {
		return { status: 200, body: generateSiteOverview() };
	}

	const match = path.match(MARKDOWN_PATH_RE);
	if (!match) {
		return { status: 404, body: "Not Found" };
	}

	const [, unitId, yearStr] = match;
	const unit = unitBasedTabs.find((t) => t.id === unitId);
	if (!unit) {
		return { status: 404, body: "Unit not found" };
	}

	const year = yearStr as Year;
	const examMapping = unit.examMapping.find((m) => m.year === year);
	if (!examMapping) {
		return { status: 404, body: "Year not available for this unit" };
	}

	const body = await generateUnitMarkdown(unit, year, examMapping.examNumbers);
	return { status: 200, body };
}

export function generateSiteOverview(): string {
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
