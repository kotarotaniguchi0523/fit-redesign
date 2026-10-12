import * as assert from 'remix/assert'
import { describe, it, mock } from 'remix/test'

import { writeClipboardText } from './clipboard.ts'

/**
 * `writeClipboardText` のテスト。`remix test` は Node 上で動くため
 * `navigator.clipboard` をテストごとに差し替える。
 */
function setClipboard(writeText: (text: string) => Promise<void>): void {
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: { clipboard: { writeText } },
	})
}

describe('writeClipboardText', () => {
	it('writes text and reports success', async () => {
		const writeText = mock.fn(async (_text: string) => undefined)
		setClipboard(writeText)

		assert.equal(await writeClipboardText('共有する文字列'), true)
		assert.deepEqual(writeText.mock.calls[0]?.arguments, ['共有する文字列'])
	})

	it('reports denied clipboard access without throwing', async () => {
		setClipboard(
			mock.fn(async () => {
				throw new Error('denied')
			}),
		)

		assert.equal(await writeClipboardText('共有する文字列'), false)
	})
})
