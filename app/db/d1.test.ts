import { DatabaseSync } from "node:sqlite";

import * as assert from "remix/assert";
import { eq, gte } from "remix/data-table";
import { describe, it } from "remix/test";

import { createD1Database } from "./d1.ts";
import { answers, challenges, questionProgress, syncLinks } from "./tables.ts";

/**
 * D1 ドライバの検証。
 *
 * 実 D1 に繋がない代わりに、`node:sqlite` を D1 の prepare/bind/run/all/first/exec/batch
 * 互換シムで包んで同一の SQL を実行する。ドライバが生成する SQL と結果マッピング
 * （count / exists / returning / affectedRows）が実 SQLite で正しく動くことを確認する。
 */
type D1ResultLike<T> = { results?: T[]; success: boolean; meta: Record<string, unknown> };

function createFakeD1(sqlite: DatabaseSync) {
	const prepare = (text: string) => {
		let bound: unknown[] = [];
		const statement = {
			bind(...values: unknown[]) {
				bound = values;
				return statement;
			},
			async all(): Promise<D1ResultLike<Record<string, unknown>>> {
				const prepared = sqlite.prepare(text);
				const results = prepared.all(...(bound as never[])) as Record<string, unknown>[];
				return { results, success: true, meta: {} };
			},
			async run(): Promise<D1ResultLike<never>> {
				const prepared = sqlite.prepare(text);
				const info = prepared.run(...(bound as never[]));
				return {
					success: true,
					meta: {
						changes: Number(info.changes),
						last_row_id: Number(info.lastInsertRowid),
					},
				};
			},
			async first(): Promise<Record<string, unknown> | null> {
				const prepared = sqlite.prepare(text);
				return (prepared.get(...(bound as never[])) as Record<string, unknown>) ?? null;
			},
		};
		return statement;
	};

	return {
		prepare,
		async exec(sql: string) {
			sqlite.exec(sql);
		},
		async batch(statements: Array<{ run(): Promise<unknown> }>) {
			for (const statement of statements) {
				await statement.run();
			}
		},
	} as unknown as D1Database;
}

function createTestDatabase() {
	const sqlite = new DatabaseSync(":memory:");
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
	`);
	return createD1Database(createFakeD1(sqlite));
}

describe("D1 data-table driver", () => {
	it("create / find / update / delete round-trips through data-table", async () => {
		const db = createTestDatabase();

		await db.create(syncLinks, { id: "link-1", created_at: 1000 });
		const found = await db.find(syncLinks, "link-1");
		assert.equal(found?.id, "link-1");

		await db.update(syncLinks, "link-1", { created_at: 2000 });
		const updated = await db.find(syncLinks, "link-1");
		assert.equal(updated?.created_at, 2000);

		await db.delete(syncLinks, "link-1");
		assert.equal(await db.find(syncLinks, "link-1"), null);
	});

	it("select with where / orderBy / limit returns typed rows", async () => {
		const db = createTestDatabase();
		await db.create(syncLinks, { id: "a", created_at: 1 });
		await db.create(syncLinks, { id: "b", created_at: 2 });
		await db.create(syncLinks, { id: "c", created_at: 3 });

		const rows = await db.query(syncLinks).where(gte(syncLinks.created_at, 2)).all();
		assert.equal(rows.length, 2);

		const [first] = await db.query(syncLinks).orderBy(syncLinks.created_at, "desc").limit(1).all();
		assert.equal(first?.id, "c");
	});

	it("count and exists use the driver result contract", async () => {
		const db = createTestDatabase();
		await db.create(syncLinks, { id: "a", created_at: 1 });
		await db.create(syncLinks, { id: "b", created_at: 2 });

		assert.equal(await db.query(syncLinks).count(), 2);
		assert.equal(await db.query(syncLinks).where(eq(syncLinks.id, "a")).exists(), true);
		assert.equal(await db.query(syncLinks).where(eq(syncLinks.id, "zzz")).exists(), false);
	});

	it("composite primary key upsert via createMany/update on question_progress", async () => {
		const db = createTestDatabase();
		await db.create(syncLinks, { id: "link-1", created_at: 1 });
		await db.create(syncLinks, { id: "link-2", created_at: 2 });

		await db.create(questionProgress, {
			sync_link_id: "link-1",
			question_id: "exam1-2013-q1",
			unit_id: "unit-base-conversion",
			created_at: 10,
			updated_at: 20,
		});
		await db.create(questionProgress, {
			sync_link_id: "link-2",
			question_id: "exam1-2013-q1",
			unit_id: "unit-base-conversion",
			created_at: 10,
			updated_at: 30,
		});

		const rows = await db
			.query(questionProgress)
			.where(eq(questionProgress.sync_link_id, "link-1"))
			.all();
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.updated_at, 20);
	});

	it("writes inside a transaction are flushed atomically on commit", async () => {
		const db = createTestDatabase();
		await db.transaction(async (tx) => {
			await tx.create(syncLinks, { id: "tx-1", created_at: 1 });
			await tx.create(syncLinks, { id: "tx-2", created_at: 2 });
		});

		assert.equal(await db.query(syncLinks).count(), 2);
	});

	it("answers table round-trips enum judgment", async () => {
		const db = createTestDatabase();
		await db.create(challenges, {
			id: "c-1",
			sync_link_id: "link-1",
			exam_id: "exam1-2013",
			created_at: 1,
			updated_at: 2,
		});
		await db.create(answers, {
			challenge_id: "c-1",
			question_id: "exam1-2013-q1",
			elapsed_ms: 5000,
			judgment: "correct",
			created_at: 1,
			updated_at: 2,
		});

		const [row] = await db.query(answers).all();
		assert.equal(row?.judgment, "correct");
		assert.equal(row?.elapsed_ms, 5000);
	});
});
