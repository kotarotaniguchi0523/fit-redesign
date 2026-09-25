// @vitest-environment node
/** biome-ignore-all lint/nursery/useExplicitReturnType: testClientのルート型はchained Hono appの推論を維持する必要がある */
import { Hono } from "hono";
import { testClient } from "hono/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CompletedChallengePayload } from "../features/challenge/types";
import { createSyncLink } from "../server/progressRepository";
import { SyncKey } from "../server/syncKey";
import { SyncLinkId } from "../server/syncLinkId";
import { createTestD1, type TestD1 } from "../types/test/d1";
import { MAX_POST_BODY_BYTES } from "./_lib";
import progress from "./progress";

class TestRateLimit implements RateLimit {
	constructor(private readonly isAllowed: boolean) {}

	limit(_options: RateLimitOptions): Promise<RateLimitOutcome> {
		return Promise.resolve({ success: this.isAllowed });
	}
}

let database: TestD1;

function env(isAllowed = true): Cloudflare.Env {
	return {
		DB: database.binding,
		PROGRESS_RATE_LIMITER: new TestRateLimit(isAllowed),
	};
}

function mountedApp() {
	const app = new Hono<{ Bindings: Cloudflare.Env }>();
	app.use("*", async (c, next) => {
		c.set("db", database.db);
		await next();
	});
	return app.route("/progress", progress);
}

function mountedClient(isAllowed = true) {
	return testClient(mountedApp(), env(isAllowed));
}

async function seedSyncLink(rawKey = "a".repeat(43)): Promise<void> {
	const key = SyncKey.parse(rawKey)._unsafeUnwrap();
	const id = (await SyncLinkId.fromSyncKey(key))._unsafeUnwrap();
	(await createSyncLink(database.db, id, 1_700_000_000_000))._unsafeUnwrap();
}

function completedChallenge(
	challengeId = "550e8400-e29b-41d4-a716-446655440000",
	judgment: "correct" | "incorrect" = "correct",
): CompletedChallengePayload {
	return {
		challengeId,
		examId: "exam1-2013",
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_100,
		answers: [
			{
				questionId: "exam1-2013-q1",
				elapsedMs: 3000,
				judgment,
				createdAt: 1_700_000_000_050,
				updatedAt: 1_700_000_000_100,
			},
		],
	};
}

beforeEach(async () => {
	database = await createTestD1();
});

afterEach(async () => {
	await database?.dispose();
});

describe("progress routes", () => {
	it("256bitのキーを一度だけ返し、D1にはハッシュだけを保存する", async () => {
		const response = await mountedClient().progress.links.$post(
			{},
			{ headers: { Origin: "http://localhost" } },
		);
		const body = SyncKey.schema.safeParse((await response.json()).key);

		expect(response.status).toBe(201);
		expect(body.success).toBe(true);
		const stored = await database.binding.prepare("SELECT id FROM sync_links").first();
		expect(stored?.id).not.toBe(body.data);
	});

	it("外部Originから同期先を発行できない", async () => {
		const response = await mountedApp().request(
			"/progress/links",
			{
				method: "POST",
				headers: { "Content-Type": "text/plain", Origin: "https://evil.example" },
			},
			env(),
		);
		expect(response.status).toBe(403);
	});

	it("POST body limitは過大な書き込みを413で止める", async () => {
		const response = await mountedApp().request(
			"/progress/links",
			{
				method: "POST",
				headers: { "Content-Type": "text/plain", Origin: "http://localhost" },
				body: "x".repeat(MAX_POST_BODY_BYTES + 1),
			},
			env(),
		);

		expect(response.status).toBe(413);
	});

	it("POST専用のbody limitはDELETEを妨げない", async () => {
		await seedSyncLink();
		const response = await mountedApp().request(
			"/progress",
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					"X-Sync-Key": "a".repeat(43),
					Origin: "http://localhost",
				},
				body: "x".repeat(MAX_POST_BODY_BYTES + 1),
			},
			env(),
		);

		expect(response.status).toBe(200);
	});

	it("同期キーがないリクエストは404にする", async () => {
		const response = await mountedApp().request(
			"/progress/sync",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: '{"entries":[]}' },
			env(),
		);
		expect(response.status).toBe(404);
	});

	it("形式が不正な同期キーは404にする", async () => {
		const response = await mountedApp().request(
			"/progress/sync",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Sync-Key": "not-a-key" },
				body: '{"entries":[]}',
			},
			env(),
		);
		expect(response.status).toBe(404);
	});

	it("301件の過大payloadを400にする", async () => {
		const entries = Array.from({ length: 301 }, (_, index) => ({
			questionId: `exam1-2013-q${index + 1}`,
			unitId: "unit-base-conversion",
			createdAt: index + 1,
			updatedAt: index + 1,
		}));
		const response = await mountedApp().request(
			"/progress/sync",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Sync-Key": "a".repeat(43) },
				body: JSON.stringify({ entries }),
			},
			env(),
		);
		expect(response.status).toBe(400);
	});

	it("形式だけ正しくてもカタログにない問題と単元の組合せは400にする", async () => {
		const response = await mountedApp().request(
			"/progress/sync",
			{
				method: "POST",
				headers: { "Content-Type": "application/json", "X-Sync-Key": "a".repeat(43) },
				body: JSON.stringify({
					entries: [
						{
							questionId: "exam1-2013-q99999",
							unitId: "unit-base-conversion",
							createdAt: 1,
							updatedAt: 1,
						},
					],
				}),
			},
			env(),
		);
		expect(response.status).toBe(400);
	});

	it("300件のpayloadを受理する", async () => {
		await seedSyncLink();
		const entries = Array.from({ length: 300 }, (_, index) => ({
			questionId: "exam1-2013-q1",
			unitId: "unit-base-conversion",
			createdAt: index + 1,
			updatedAt: index + 1,
		}));
		const response = await mountedClient().progress.sync.$post({
			json: { entries },
			header: { "x-sync-key": "a".repeat(43) },
		});
		expect(response.status).toBe(200);
	});

	it("完了済みチャレンジを冪等に同期し、異なるpayloadは409にする", async () => {
		await seedSyncLink();
		const first = completedChallenge();
		const client = mountedClient();
		const response = await client.progress.challenges.$post({
			json: { challenges: [first] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		const repeated = await client.progress.challenges.$post({
			json: { challenges: [first, first] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		const conflict = await client.progress.challenges.$post({
			json: { challenges: [completedChallenge(first.challengeId, "incorrect")] },
			header: { "x-sync-key": "a".repeat(43) },
		});

		expect(response.status).toBe(200);
		expect(repeated.status).toBe(200);
		expect(conflict.status).toBe(409);
		const challengeCount = await database.binding
			.prepare("SELECT COUNT(*) AS count FROM challenges")
			.first<{ count: number }>();
		const answerCount = await database.binding
			.prepare("SELECT COUNT(*) AS count FROM answers")
			.first<{ count: number }>();
		expect(challengeCount?.count).toBe(1);
		expect(answerCount?.count).toBe(1);
	});

	it("単問の問題IDも対象試験のカタログに存在する必要がある", async () => {
		await seedSyncLink();
		const invalid = completedChallenge("550e8400-e29b-41d4-a716-446655440001");
		const response = await mountedClient().progress.challenges.$post({
			json: {
				challenges: [
					{
						...invalid,
						answers: [{ ...invalid.answers[0], questionId: "exam1-2013-q99999" }],
					},
				],
			},
			header: { "x-sync-key": "a".repeat(43) },
		});

		expect(response.status).toBe(400);
	});

	it("空のchallenge同期は既存結果を取得し、未知のリンクは404にする", async () => {
		await seedSyncLink();
		const client = mountedClient();
		await client.progress.challenges.$post({
			json: { challenges: [completedChallenge()] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		const pulled = await client.progress.challenges.$post({
			json: { challenges: [] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		const missing = await mountedClient().progress.challenges.$post({
			json: { challenges: [] },
			header: { "x-sync-key": "b".repeat(43) },
		});

		expect(pulled.status).toBe(200);
		expect((await pulled.json()).challenges).toHaveLength(1);
		expect(missing.status).toBe(404);
	});

	it("端末から送られた遠い未来の確認時刻を拒否する", async () => {
		await seedSyncLink();
		const response = await mountedClient().progress.sync.$post({
			json: {
				entries: [
					{
						questionId: "exam1-2013-q1",
						unitId: "unit-base-conversion",
						createdAt: 4_000_000_000_000,
						updatedAt: 4_000_000_000_000,
					},
				],
			},
			header: { "x-sync-key": "a".repeat(43) },
		});

		expect(response.status).toBe(400);
	});

	it("未知の同期領域は404にする", async () => {
		const response = await mountedClient().progress.sync.$post({
			json: { entries: [] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		expect(response.status).toBe(404);
	});

	it("レート上限を超えた同期は429にする", async () => {
		const response = await mountedClient(false).progress.sync.$post({
			json: { entries: [] },
			header: { "x-sync-key": "a".repeat(43) },
		});
		expect(response.status).toBe(429);
	});

	it("同期データ削除は存在有無によらず冪等に成功する", async () => {
		await seedSyncLink();
		const response = await mountedClient().progress.$delete(
			{
				header: { "x-sync-key": "a".repeat(43) },
			},
			{ headers: { Origin: "http://localhost" } },
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("削除済み同期領域を再削除しても成功する", async () => {
		const response = await mountedClient().progress.$delete(
			{
				header: { "x-sync-key": "a".repeat(43) },
			},
			{ headers: { Origin: "http://localhost" } },
		);
		expect(response.status).toBe(200);
	});
});
