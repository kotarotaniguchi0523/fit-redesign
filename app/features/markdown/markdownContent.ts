import { getExamByNumber } from "../../data/exams";
import { unitBasedTabs } from "../../data/units";
import type { ExamNumber, Question, Year } from "../../types";

/**
 * AI エージェント向け Markdown コンテンツ生成（純粋ロジック）。
 * Hono ルート（/markdown/*）から呼ばれ、Response 生成は呼び出し側が担う。
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
	const unitRows = unitBasedTabs.map((unit) => {
		const years = unit.examMapping.map((m) => m.year).join(", ");
		return `| ${unit.name} | ${unit.description} | ${years} |`;
	});
	const endpointRows = unitBasedTabs.flatMap((unit) =>
		unit.examMapping.map(
			(mapping) =>
				`- \`/markdown/${unit.id}/${mapping.year}\` - ${unit.name} (${mapping.year}年度)`,
		),
	);

	return [
		"# 基本情報技術 I - 明治大学 演習問題サイト",
		"",
		"明治大学の「基本情報技術 I」講義の演習問題を単元別・年度別に整理したサイトです。",
		"2013〜2017年度の小テスト問題を掲載しています。",
		"",
		"## 単元一覧",
		"",
		"| 単元 | 概要 | 年度 |",
		"|------|------|------|",
		...unitRows,
		"",
		"## エンドポイント",
		"",
		"各単元の問題と解答をMarkdownで取得:",
		"",
		...endpointRows,
	].join("\n");
}

function questionMarkdownLines(question: Question): string[] {
	const optionLines = question.options?.length
		? [...question.options.map((option) => `- **${option.label}**: ${option.value}`), ""]
		: [];
	const figureLines = question.figureDescription ? [`*図: ${question.figureDescription}*`, ""] : [];
	const explanationLines = question.explanation ? [`**解説:** ${question.explanation}`, ""] : [];

	return [
		`### 問題 ${question.number}`,
		"",
		question.text,
		"",
		...optionLines,
		...figureLines,
		`**解答:** ${question.answer}`,
		"",
		...explanationLines,
		"---",
		"",
	];
}

async function examMarkdownLines(examNum: ExamNumber, year: Year): Promise<string[]> {
	const examByYear = await getExamByNumber(examNum);
	const exam = examByYear?.exams[year];
	if (!exam) return [];

	return [`## ${exam.title}`, "", ...exam.questions.flatMap(questionMarkdownLines)];
}

async function generateUnitMarkdown(
	unit: (typeof unitBasedTabs)[number],
	year: Year,
	examNumbers: ExamNumber[],
): Promise<string> {
	const examLines = (
		await Promise.all(examNumbers.map((examNum) => examMarkdownLines(examNum, year)))
	).flat();

	return [
		`# ${unit.title} (${year}年度)`,
		"",
		`> ${unit.description}`,
		"",
		`- 講義: 基本情報技術 I（明治大学）`,
		`- 単元: ${unit.name}`,
		`- 年度: ${year}`,
		"",
		...examLines,
	].join("\n");
}
