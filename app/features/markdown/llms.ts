import { getExamByNumber } from "../../data/exams/index.ts";
import { SITE_URL } from "../../data/site.ts";
import { unitBasedTabs } from "../../data/units.ts";
import type { DeepReadonly } from "../../lib/immutable.ts";
import type { ExamNumber, Question, Year } from "../../types/index.ts";
import { questionToMarkdown } from "./questionToMarkdown.ts";

/**
 * AI エージェント向け要約（llms.txt / llms-full.txt）。
 * 旧 `app/routes/llms*.txt.ts` を framework 非依存の純関数へ移植したもの。
 */

/** 単元1件分の llms.txt セクション。末尾スラッシュ無しで出力する。 */
function unitSection(unit: (typeof unitBasedTabs)[number]): string[] {
	const yearLines = unit.examMapping.map(
		(mapping) => `- ${mapping.year}年度: ${SITE_URL}/${unit.id}/${mapping.year}`,
	);
	return [`### ${unit.title}`, `- 概要: ${unit.description}`, ...yearLines, ""];
}

export function generateLlmsTxt(): string {
	return [
		"# 基本情報技術 I - 明治大学 演習問題サイト",
		"",
		"> 明治大学の「基本情報技術 I」講義の小テストを単元・年度別に見やすく整理し、答えと解説をすぐ確認できるサイト。確認履歴は端末内に保存され、任意で秘密リンクを使って同期できる。",
		"",
		"## サイト構造",
		"",
		`- トップページ: ${SITE_URL}/`,
		`- 使い方ガイド: ${SITE_URL}/guide`,
		`- 学習記録（検索対象外）: ${SITE_URL}/records`,
		"",
		"## 単元一覧（演習問題ページ）",
		"",
		...unitBasedTabs.flatMap(unitSection),
		"## 講義資料のみ",
		`- ${SITE_URL}/slide-only`,
		"",
		"## 技術情報",
		"- フレームワーク: Remix 3（remix/router + remix/component）",
		"- ホスティング: Cloudflare Workers（Assets + D1）",
		"- データベース: Cloudflare D1（remix/data-table）",
		"- 言語: TypeScript",
		"",
	].join("\n");
}

function questionLines(question: DeepReadonly<Question>): string[] {
	return [...questionToMarkdown(question, { headingLevel: 3 }).split("\n"), "---", ""];
}

async function examLines(unitName: string, year: Year, examNumber: ExamNumber): Promise<string[]> {
	const exam = (await getExamByNumber(examNumber))?.exams[year];
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
	const nested = await Promise.all(
		unit.examMapping.flatMap((mapping) =>
			mapping.examNumbers.map((examNumber) => examLines(unit.name, mapping.year, examNumber)),
		),
	);
	return [`# ${unit.title}`, "", unit.description, "", ...nested.flat()];
}

export async function generateLlmsFullTxt(): Promise<string> {
	const nestedUnitLines = await Promise.all(unitBasedTabs.map(unitLines));
	return [
		"# 基本情報技術 I - 明治大学 小テスト（完全版）",
		"",
		"> 明治大学の「基本情報技術 I」講義の小テストを全て収録。2013〜2017年度の問題と解答・解説を単元別に整理。",
		"",
		"---",
		"",
		...nestedUnitLines.flat(),
	].join("\n");
}
