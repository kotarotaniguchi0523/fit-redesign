import * as assert from "remix/assert";
import { afterAll, describe, it } from "remix/test";

import { closeAppServer, DESKTOP, MOBILE, openExamPlayerViaUi, serveApp } from "./app.ts";

/** 対象の単元（実データ）。導線・アサーションの基準として 1 か所にまとめる。 */
const UNIT = { unitName: "基数変換", year: "2017", questionNumber: 1 } as const;

/**
 * 主要導線の E2E（ブラックボックス）。
 *
 * 実際の利用者と同じく画面のリンクをたどり、Page Object（`./app.ts`）経由で操作する。
 * テスト対象のアプリは 1 つを共有し、各テストは新しいページから始める。
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

	it("トップ → 単元 → 単問へリンクで移動できる（SSR 導線）", async (t) => {
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

	it("小テストプレイヤーで解答を開き、自己判定できる（島が hydrate する）", async (t) => {
		const app = await serveApp(t, DESKTOP);

		await openExamPlayerViaUi(app, UNIT);
		await app.examPlayer.waitForInteractive();
		await app.examPlayer.revealAnswer();
		await app.examPlayer.judge("correct");
	});

	it("問題一覧ドロワが開く", async (t) => {
		const app = await serveApp(t, DESKTOP);

		await openExamPlayerViaUi(app, UNIT);
		await app.examPlayer.waitForInteractive();
		await app.examPlayer.openQuestionListButton.click();
		await app.examPlayer.questionListPanel.waitFor();
	});

	it("狭い画面ではアコーディオンで年度を選べる", async (t) => {
		const app = await serveApp(t, MOBILE);

		await app.home.open();
		await app.home.accordionTrigger(UNIT.unitName).click();
		await app.home.accordionYearLink(UNIT.year).waitFor();
	});
});
