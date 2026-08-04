// @vitest-environment node
/** biome-ignore-all lint/nursery/useExplicitReturnType: testClientのルート型はchained Hono appの推論を維持する必要がある */
import { Hono } from "hono";
import { testClient } from "hono/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSyncSpace } from "../server/progressRepository";
import { SyncKey } from "../server/syncKey";
import { SyncSpaceId } from "../server/syncSpaceId";
import { createTestD1, type TestD1 } from "../types/test/d1";
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

async function seedSyncSpace(rawKey = "a".repeat(43)): Promise<void> {
	const key = SyncKey.parse(rawKey)._unsafeUnwrap();
	const id = (await SyncSpaceId.fromSyncKey(key))._unsafeUnwrap();
	(await createSyncSpace(database.db, id, 1_700_000_000_000))._unsafeUnwrap();
}

beforeEach(async () => {
	database = await createTestD1();
});

afterEach(async () => {
	await database?.dispose();
});

describe("progress routes", () => {
	it("256bitのキーを一度だけ返し、D1にはハッシュだけを保存する", async () => {
		const response = await mountedClient().progress.spaces.$post(
			{},
			{ headers: { Origin: "http://localhost" } },
		);
		const body = SyncKey.schema.safeParse((await response.json()).key);

		expect(response.status).toBe(201);
		expect(body.success).toBe(true);
		const stored = await database.binding.prepare("SELECT id FROM sync_spaces").first();
		expect(stored?.id).not.toBe(body.data);
	});

	it("外部Originから同期先を発行できない", async () => {
		const response = await mountedApp().request(
			"/progress/spaces",
			{
				method: "POST",
				headers: { "Content-Type": "text/plain", Origin: "https://evil.example" },
			},
			env(),
		);
		expect(response.status).toBe(403);
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
			revealedAt: index + 1,
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
						{ questionId: "exam1-2013-q99999", unitId: "unit-base-conversion", revealedAt: 1 },
					],
				}),
			},
			env(),
		);
		expect(response.status).toBe(400);
	});

	it("300件のpayloadを受理する", async () => {
		await seedSyncSpace();
		const entries = Array.from({ length: 300 }, (_, index) => ({
			questionId: "exam1-2013-q1",
			unitId: "unit-base-conversion",
			revealedAt: index + 1,
		}));
		const response = await mountedClient().progress.sync.$post({
			json: { entries },
			header: { "x-sync-key": "a".repeat(43) },
		});
		expect(response.status).toBe(200);
	});

	it("端末から送られた遠い未来の確認時刻を拒否する", async () => {
		await seedSyncSpace();
		const response = await mountedClient().progress.sync.$post({
			json: {
				entries: [
					{
						questionId: "exam1-2013-q1",
						unitId: "unit-base-conversion",
						revealedAt: 4_000_000_000_000,
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
		await seedSyncSpace();
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
