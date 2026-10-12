import type { Database } from 'remix/data-table'

/**
 * リクエストをまたいで共有する D1 データベースのレジストリ。
 *
 * Worker エントリ（`app/worker.ts`）がバインディングから構築して登録し、
 * ミドルウェアがリクエストコンテキストへ載せる。
 * `cloudflare:workers` への依存をルーターの import グラフから外すことで、
 * Node（`remix test` や SSR スモーク）でもルーターを読み込めるようにする。
 */
export type AppDatabase = Database<'d1'>

let database: AppDatabase | null = null

export function setDatabase(next: AppDatabase | null): void {
	database = next
}

export function getDatabase(): AppDatabase | null {
	return database
}
