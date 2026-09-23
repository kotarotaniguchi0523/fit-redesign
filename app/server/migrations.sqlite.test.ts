// @vitest-environment node
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../types/test/migrations";

let database: Database.Database;

beforeEach(async () => {
	database = new Database(":memory:");
	database.pragma("foreign_keys = ON");
	await applyMigrations((migration) => database.exec(migration));
});

afterEach(() => database.close());

describe("D1 migrations on SQLite", () => {
	it("全migrationを適用するとDrizzleの現行テーブルと検索indexが揃う", () => {
		const tables = database
			.prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all()
			.map(({ name }) => name);
		const challengeColumns = database
			.prepare<[], { name: string }>("PRAGMA table_info(challenges)")
			.all()
			.map(({ name }) => name);
		const indexes = database
			.prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")
			.all()
			.map(({ name }) => name);

		expect(tables).toContain("challenges");
		expect(tables).toContain("answers");
		expect(challengeColumns).toEqual(["id", "sync_link_id", "exam_id", "created_at", "updated_at"]);
		expect(indexes).toContain("idx_challenges_recent");
		expect(database.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
	});

	it("不正な時刻・解答時間・判定値をDB制約で拒否する", () => {
		database.prepare("INSERT INTO sync_links (id, created_at) VALUES (?, ?)").run("link-a", 1);
		database
			.prepare(
				"INSERT INTO challenges (id, sync_link_id, exam_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			)
			.run("challenge-a", "link-a", "exam1-2013", 10, 20);

		expect(() =>
			database
				.prepare(
					"INSERT INTO challenges (id, sync_link_id, exam_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
				)
				.run("challenge-b", "link-a", "exam1-2013", 20, 10),
		).toThrow();
		expect(() =>
			database
				.prepare(
					"INSERT INTO answers (challenge_id, question_id, elapsed_ms, judgment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run("challenge-a", "exam1-2013-q1", -1, "correct", 10, 20),
		).toThrow();
		expect(() =>
			database
				.prepare(
					"INSERT INTO answers (challenge_id, question_id, elapsed_ms, judgment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run("challenge-a", "exam1-2013-q1", 100, "unknown", 10, 20),
		).toThrow();
	});

	it("sync linkを削除すると関連するchallengeとanswersも削除する", () => {
		database.prepare("INSERT INTO sync_links (id, created_at) VALUES (?, ?)").run("link-a", 1);
		database
			.prepare(
				"INSERT INTO challenges (id, sync_link_id, exam_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			)
			.run("challenge-a", "link-a", "exam1-2013", 10, 20);
		database
			.prepare(
				"INSERT INTO answers (challenge_id, question_id, elapsed_ms, judgment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run("challenge-a", "exam1-2013-q1", 100, "correct", 10, 20);

		database.prepare("DELETE FROM sync_links WHERE id = ?").run("link-a");

		const challengeCount = database
			.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM challenges")
			.get();
		const answerCount = database
			.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM answers")
			.get();
		expect(challengeCount.count).toBe(0);
		expect(answerCount.count).toBe(0);
	});
});
