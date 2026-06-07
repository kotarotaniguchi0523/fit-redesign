/**
 * Vitest 用 `astro:content` スタブ。
 * Astro の仮想モジュール `astro:content` は vitest では解決できないため、
 * vitest.config.ts の alias でこのスタブに差し替える。
 * Content Collection に依存するロジック（data/exams/loader）を読み込むテストが
 * import エラーにならないようにするのが目的（中身は空コレクションを返す）。
 */
export function getCollection(): Promise<unknown[]> {
	return Promise.resolve([]);
}
