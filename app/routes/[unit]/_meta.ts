import type { UnitBasedTab, Year } from "../../types";

// 単元ページの SEO/メタ生成（title / description / JSON-LD）。[year].tsx から co-location 切り出し。
// `_` 接頭辞で HonoX のルーティングから除外される純関数群。

// exam ラベルの接頭スペース付き断片（空ラベル＝単一 exam 年度なら何も付けない）。
function examPartOf(examLabel: string): string {
	return examLabel ? ` ${examLabel}` : "";
}

// ページタイトルを生成する（複数 exam がある年度のみ exam 番号を付ける）
export function buildPageTitle(unit: UnitBasedTab, year: Year, examLabel: string): string {
	return `${unit.title} (${year}年度)${examPartOf(examLabel)} - 基本情報技術 I`;
}

// ページ説明文を生成する
export function buildPageDescription(
	unit: UnitBasedTab,
	year: Year,
	examLabel: string,
	totalQuestions: number,
): string {
	const questionText = totalQuestions > 0 ? `（全${totalQuestions}問）` : "";
	return `明治大学 基本情報技術 I「${unit.name}」${year}年度${examPartOf(examLabel)}の演習問題${questionText}。${unit.description}`;
}

// JSON-LD スキーマを生成する
export function buildJsonLd(
	unit: UnitBasedTab,
	year: Year,
	examLabel: string,
	totalQuestions: number,
	pageDescription: string,
): Record<string, unknown> {
	const examPart = examPartOf(examLabel);
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Quiz",
				name: `${unit.name} - ${year}年度演習問題${examPart}`,
				about: {
					"@type": "Thing",
					name: unit.name,
					description: unit.description,
				},
				educationalLevel: "大学学部",
				inLanguage: "ja",
				isPartOf: {
					"@type": "Course",
					name: "基本情報技術 I",
					provider: {
						"@type": "EducationalOrganization",
						name: "明治大学",
					},
				},
				...(totalQuestions > 0 ? { numberOfQuestions: totalQuestions } : {}),
			},
			{
				"@type": "LearningResource",
				name: `${unit.title} (${year}年度)${examPart}`,
				description: pageDescription,
				learningResourceType: "Practice Problem",
				educationalLevel: "大学学部",
				inLanguage: "ja",
				teaches: unit.description,
			},
		],
	};
}
