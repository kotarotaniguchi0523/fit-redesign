import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { router } from "../router.ts";

/**
 * プログレッシブ・エンハンスメントの検証。
 *
 * JS が無くても辿れることを、サーバーが返す HTML の構造（アンカーと href、
 * Frame ソースの存在）で確認する。ブラウザー無しで実行できる。
 */
async function html(path: string): Promise<string> {
	const response = await router.fetch(new Request(`http://localhost${path}`));
	assert.equal(response.status, 200, `${path} should be 200`);
	return response.text();
}

describe("progressive enhancement", () => {
	it("トップページの単元・年度はリンクで辿れる", async () => {
		const body = await html("/");
		assert.ok(body.includes('href="/unit-base-conversion/2017"'), "unit-year link");
	});

	it("単元ページの問題はリンクで辿れる", async () => {
		const body = await html("/unit-base-conversion/2017");
		assert.ok(
			body.includes("/unit-base-conversion/2017/exam/1/question/exam1-2017-q1"),
			"question link",
		);
	});

	it("Frame ソースは Document を含まない領域だけを返す", async () => {
		const region = await html("/unit-base-conversion/2017/region");
		assert.ok(!region.includes("<html"), "region must not include the document shell");
		assert.ok(region.includes("小テスト"), "region contains the exam list");

		const questionRegion = await html(
			"/unit-base-conversion/2017/exam/1/question/exam1-2017-q1/region",
		);
		assert.ok(!questionRegion.includes("<html"), "question region must not include the shell");
	});

	it("小テストページはサーバーでも問題文を描く（JS 無効でも閲覧できる）", async () => {
		const body = await html("/unit-base-conversion/2017/exam/1");
		assert.ok(body.includes('data-player="preview"'), "server renders the static preview");
		assert.ok(body.includes("基数変換"), "preview shows the question");
	});

	it("小テストページは問題領域の Frame ソースを持つ", async () => {
		const body = await html("/unit-base-conversion/2017/exam/1");
		assert.ok(body.includes("/region"), "frame source is referenced");
	});

	it("学習記録はサーバーでシェルを描き、島が端末内データを読む", async () => {
		const body = await html("/records");
		assert.ok(body.includes("学習記録"), "records heading");
		assert.ok(body.includes("RecordsView"), "records client entry marker");
	});

	it("ヘルスチェックは JSON を返す", async () => {
		const response = await router.fetch(new Request("http://localhost/health"));
		assert.equal(response.status, 200);
		const body = (await response.json()) as { status?: string };
		assert.equal(body.status, "ok");
	});
});
