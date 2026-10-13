import * as assert from "remix/assert";
import { afterAll, describe, it } from "remix/test";

import { closeAppServer, DESKTOP, serveApp } from "./app.ts";

/** 対象の単元（実データ）。導線・アサーションの基準として 1 か所にまとめる。 */
const UNIT = {
	unitId: "base-conversion",
	unitName: "基数変換",
	year: "2017",
	questionNumber: 1,
} as const;

/**
 * 主要導線の E2E（ブラックボックス）。
 *
 * 実際の利用者と同じく画面のリンクをたどり、Page Object（`./app.ts`）経由で操作する。
 * テスト対象のアプリは 1 つを共有し、各テストは新しいページから始める。
 *
 * 島（clientEntry）の操作はブラウザーコンポーネントテスト（`*.test.browser.tsx`）が
 * 担うため、ここはサーバー描画だけで成立する導線に絞る（Testing ガイドの方針）。
 */
describe("サイト導線", () => {
	afterAll(closeAppServer);

	it("トップページに単元・年度リンク・ヘッダーが描画される", async (t) => {
		const app = await serveApp(t, DESKTOP);

		await app.home.open();
		await app.home.navigation.waitFor();
		await app.home.unitName(UNIT.unitName).waitFor();
		await app.home.yearLink(UNIT.unitName, "2013").waitFor();
	});

	it("トップ → 単元 → 単問へリンクで移動できる", async (t) => {
		const app = await serveApp(t, DESKTOP);

		await app.home.open();
		await app.home.yearLink(UNIT.unitName, UNIT.year).click();
		await app.unitYear.heading(UNIT.unitName).waitFor();

		await app.unitYear.questionLink(UNIT.questionNumber).click();
		await app.examPlayer.anyPlayer.waitFor();
		assert.match(
			new URL(app.page.url()).pathname,
			/^\/unit-base-conversion\/2017\/exam\/1\/question\//,
		);
	});

	it("存在しない単元は 404 ページを返す", async (t) => {
		const app = await serveApp(t, DESKTOP);

		const response = await app.page.goto("/no-such-unit/2017");
		assert.equal(response?.status(), 404);
		await app.page.getByRole("heading", { name: "ページが見つかりません" }).waitFor();
	});
});
