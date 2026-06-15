// biome-ignore lint/correctness/noNodejsModules: テスト専用ハーネス（Node 上の vitest でのみ実行）でマイグレーション SQL を読む
import { readFileSync } from "node:fs";
// biome-ignore lint/correctness/noNodejsModules: テスト専用ハーネス（Node 上の vitest でのみ実行）でパス解決する
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { type Db, schema } from "../../server/schema";

/**
 * テスト用のインメモリ SQLite を baseline + 追加マイグレーション適用済みで生成する。
 *
 * D1 と同じ SQLite 方言で実 SQL を実行し、repository / route を実 DB に対して検証する
 * （fake-D1 では Drizzle の leftJoin / 相関サブクエリ / returning が再現できないため）。
 * better-sqlite3 の Drizzle インスタンスは production の D1 Drizzle と同じクエリビルダ API を
 * 持つので Db へキャストして注入する（cast はテストコード内に限定し、本番型は不変）。
 */
const MIGRATIONS = ["0001_baseline.sql", "0002_add_answers_set_id.sql"];

export interface TestDb {
	db: Db;
	close: () => void;
}

export function createTestDb(): TestDb {
	const sqlite = new Database(":memory:");
	sqlite.pragma("foreign_keys = ON");
	// 全マイグレーションを連結して一括適用する（baseline は questions seed 180 件を含む）。
	const migrationSql = MIGRATIONS.map((file) =>
		readFileSync(join(process.cwd(), "migrations", file), "utf8"),
	).join("\n");
	sqlite.exec(migrationSql);
	// drizzle beta の better-sqlite3 driver は第1引数を config として分解するため、既存接続を
	// 渡すには { client } 形式が必須（drizzle(sqlite, ...) だと別の空 DB を生成してしまう）。
	return { db: drizzle({ client: sqlite, schema }) as unknown as Db, close: () => sqlite.close() };
}
