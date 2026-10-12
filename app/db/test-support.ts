import { DatabaseSync } from 'node:sqlite'

import { createD1Database } from './d1.ts'

/**
 * テスト用の D1 互換シム。`node:sqlite` を D1 の
 * prepare / bind / all / run / first / exec / batch 互換で包む。
 * 実 D1 に繋がずにドライバとリポジトリの SQL を実 SQLite で検証するために使う。
 */
type D1ResultLike<T> = { results?: T[]; success: boolean; meta: Record<string, unknown> }

export function createFakeD1(sqlite: DatabaseSync): D1Database {
	const prepare = (text: string) => {
		let bound: unknown[] = []
		const statement = {
			bind(...values: unknown[]) {
				bound = values
				return statement
			},
			async all(): Promise<D1ResultLike<Record<string, unknown>>> {
				const prepared = sqlite.prepare(text)
				const results = prepared.all(...(bound as never[])) as Record<string, unknown>[]
				return { results, success: true, meta: {} }
			},
			async run(): Promise<D1ResultLike<never>> {
				const prepared = sqlite.prepare(text)
				const info = prepared.run(...(bound as never[]))
				return {
					success: true,
					meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
				}
			},
			async first(): Promise<Record<string, unknown> | null> {
				const prepared = sqlite.prepare(text)
				return (prepared.get(...(bound as never[])) as Record<string, unknown>) ?? null
			},
		}
		return statement
	}

	return {
		prepare,
		async exec(sql: string) {
			sqlite.exec(sql)
		},
		async batch(statements: Array<{ run(): Promise<unknown> }>) {
			for (const statement of statements) {
				await statement.run()
			}
		},
	} as unknown as D1Database
}

/** `migrations/0001_initial.sql` と同じスキーマで空の D1 互換 DB を作る。 */
export function createTestDatabase() {
	const sqlite = new DatabaseSync(':memory:')
	sqlite.exec(`
		CREATE TABLE sync_links (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL);
		CREATE TABLE question_progress (
			sync_link_id TEXT NOT NULL, question_id TEXT NOT NULL, unit_id TEXT NOT NULL,
			created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
			PRIMARY KEY (sync_link_id, question_id)
		);
		CREATE TABLE challenges (
			id TEXT PRIMARY KEY NOT NULL, sync_link_id TEXT NOT NULL, exam_id TEXT NOT NULL,
			created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
		);
		CREATE TABLE answers (
			challenge_id TEXT NOT NULL, question_id TEXT NOT NULL, elapsed_ms INTEGER NOT NULL,
			judgment TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
			PRIMARY KEY (challenge_id, question_id)
		);
	`)
	return createD1Database(createFakeD1(sqlite))
}
