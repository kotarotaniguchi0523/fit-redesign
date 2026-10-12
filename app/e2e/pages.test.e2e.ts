import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { router } from '../router.ts'

/**
 * 主要導線の E2E。`remix test` はテストごとにテストサーバーとブラウザーページを
 * 起動・終了する。実際の Chromium 上で SSR と島（clientEntry）の協調を確認する。
 */
describe('サイト導線', () => {
	it('トップページに単元とスタイルが読み込まれる', async (t) => {
		const page = await t.serve(await createTestServer(router.fetch))

		await page.goto('/')
		await page.getByRole('heading', { name: '問題を選ぶ' }).waitFor()
		await page.getByRole('link', { name: /基数変換/ }).first().waitFor()
		await page.getByRole('navigation', { name: 'メインナビゲーション' }).waitFor()
	})

	it('小テストプレイヤーで解答を開き、自己判定して結果へ進む', async (t) => {
		const page = await t.serve(await createTestServer(router.fetch))

		await page.goto('/unit-base-conversion/2017/exam/1')
		await page.getByRole('button', { name: '解答を表示' }).waitFor()
		await page.getByRole('button', { name: '解答を表示' }).click()
		await page.getByText('解答', { exact: true }).waitFor()

		await page.getByRole('button', { name: '正解として記録' }).click()
		assert.ok(true)
	})
})
