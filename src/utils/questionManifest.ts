import { getExamByNumber } from "../data/exams";
import { unitBasedTabs } from "../data/units";
import type { Question, UnitBasedTab, Year } from "../types/index";

/**
 * 単元ごとの問題ID一覧。
 * クライアントの進捗計算（達成度・続きから・復習）で使うため、
 * 軽量な形でページに埋め込んでから配信する。
 */
export interface UnitManifestEntry {
	id: string;
	name: string;
	description: string;
	/** 進捗カードや「続きから」のリンク先となる代表年度 */
	primaryYear: Year;
	/** この単元に属する全問題ID（年度・統合試験をまたいで重複排除済み） */
	questionIds: string[];
}

/**
 * 単元に属する全問題を年度・統合試験をまたいで収集する（id重複排除）。
 * マニフェスト生成と今日の道(today/[unit])の両方で使う唯一の収集ロジック。
 */
export async function getUnitQuestions(unit: UnitBasedTab): Promise<Question[]> {
	const questionArrays = await Promise.all(
		unit.examMapping.flatMap((mapping) =>
			mapping.examNumbers.map(async (examNumber) => {
				const examByYear = await getExamByNumber(examNumber);
				return examByYear?.exams[mapping.year]?.questions ?? [];
			}),
		),
	);
	const seen = new Set<string>();
	return questionArrays.flat().filter((q) => {
		if (seen.has(q.id)) return false;
		seen.add(q.id);
		return true;
	});
}

/**
 * 既存の単元定義＋試験データから単元マニフェストを組み立てる。
 * Astro のページ frontmatter（ビルド時）で呼び出す想定。
 */
export async function buildUnitManifest(): Promise<UnitManifestEntry[]> {
	return Promise.all(
		unitBasedTabs.map(async (unit) => {
			const questions = await getUnitQuestions(unit);
			return {
				id: unit.id,
				name: unit.name,
				description: unit.description,
				primaryYear: unit.examMapping[0]?.year ?? unitBasedTabs[0].examMapping[0].year,
				questionIds: questions.map((q) => q.id),
			};
		}),
	);
}
