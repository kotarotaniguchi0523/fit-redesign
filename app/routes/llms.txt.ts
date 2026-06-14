import { createRoute } from "honox/factory";
import { SITE_URL } from "../data/site";
import { unitBasedTabs } from "../data/units";

/** 単元1件分の llms.txt セクション（title・概要・年度別演習URL）。末尾スラッシュ無しで出力する。 */
function unitSection(unit: (typeof unitBasedTabs)[number]): string[] {
	const yearLines = unit.examMapping.map(
		(mapping) => `- ${mapping.year}年度: ${SITE_URL}/${unit.id}/${mapping.year}`,
	);
	return [`### ${unit.title}`, `- 概要: ${unit.description}`, ...yearLines, ""];
}

/**
 * AI エージェント向けサイト要約（llms.txt 規約）。
 * URL は SITE_URL から、単元一覧は unitBasedTabs から動的生成し静的ファイルのドリフトを解消する。
 * 技術情報は現実体（HonoX / Cloudflare Workers / D1 / TypeScript）に修正済み。
 * SSR + Cache-Control でエッジキャッシュ。
 */
export default createRoute((c) => {
	const lines = [
		"# 基本情報技術 I - 明治大学 演習問題サイト",
		"",
		"> 明治大学の「基本情報技術 I」講義の演習問題サイト。2013〜2017年度の小テスト問題を単元別に整理し、選択肢の正誤記録と学習ダッシュボードを提供する。",
		"",
		"## サイト構造",
		"",
		`- トップページ: ${SITE_URL}/`,
		`- 使い方ガイド: ${SITE_URL}/guide`,
		"",
		"## 単元一覧（演習問題ページ）",
		"",
		...unitBasedTabs.flatMap(unitSection),
		"## 講義資料のみ",
		`- ${SITE_URL}/slide-only`,
		"",
		"## 技術情報",
		"- フレームワーク: HonoX（Hono メタフレームワーク / Islands Architecture）",
		"- ホスティング: Cloudflare Workers",
		"- データベース: Cloudflare D1",
		"- 言語: TypeScript",
		"",
	];
	c.header("Content-Type", "text/plain; charset=utf-8");
	c.header("Cache-Control", "public, max-age=86400");
	return c.body(lines.join("\n"));
});
