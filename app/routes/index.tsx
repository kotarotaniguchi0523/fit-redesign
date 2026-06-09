/** @jsxImportSource hono/jsx */
import { createRoute } from "honox/factory";
import { Header } from "../components/Header";
import { SITE_URL } from "../data/site";
import { buildUnitManifest } from "../features/srs/questionManifest";
import StudyHome from "../features/study/$StudyHome";
import { YEARS } from "../types";

// 学習ホーム。進捗計算と表示は StudyHome island が所有する。
export default createRoute(async (c) => {
	const manifest = await buildUnitManifest();

	// JSON-LD: WebSite + Course
	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				name: "基本情報技術 I - 明治大学",
				url: `${SITE_URL}/`,
				description:
					"明治大学の基本情報技術 I 講義の演習問題サイト。2013〜2017年度の9単元・全問題を掲載。",
				inLanguage: "ja",
				publisher: { "@type": "EducationalOrganization", name: "明治大学" },
			},
			{
				"@type": "Course",
				name: "基本情報技術 I",
				description:
					"基数変換、負数表現、浮動小数点、論理演算、集合と確率、オートマトン、符号理論、データ構造、ソート・探索の9単元を学習する情報技術の基礎講義。",
				provider: { "@type": "EducationalOrganization", name: "明治大学" },
				educationalLevel: "大学学部",
				inLanguage: "ja",
				numberOfCredits: 2,
				hasCourseInstance: YEARS.map((y) => ({
					"@type": "CourseInstance",
					name: `基本情報技術 I (${y}年度)`,
					courseMode: "onsite",
				})),
			},
		],
	};

	// buildUnitManifest は SSR でリクエストごとに実行されるため、エッジキャッシュを効かせる
	// （[unit]/[year].tsx と同方針）。
	c.header("Cache-Control", "public, s-maxage=31536000, max-age=3600");

	return c.render(
		<>
			<Header currentPath={c.req.path} />
			<main class="study-shell">
				<div class="container mx-auto max-w-4xl px-4 py-8">
					<StudyHome manifest={manifest} />
				</div>
			</main>
		</>,
		{
			title: "基本情報技術 I - 明治大学",
			description:
				"明治大学の基本情報技術 I 講義の演習問題サイト。基数変換・論理演算・オートマトンなど9単元、2013〜2017年度の全問題を掲載。",
			jsonLd,
		},
	);
});
