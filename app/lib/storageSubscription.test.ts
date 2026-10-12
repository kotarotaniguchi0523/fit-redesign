import * as assert from 'remix/assert'
import { before, describe, it, mock } from 'remix/test'

import { subscribeToStorageChanges } from './storageSubscription.ts'

/**
 * `subscribeToStorageChanges` のテスト。`remix test` は Node 上で動くため、
 * `window` と `StorageEvent` の最小実装を与える。
 */
before(() => {
	if (typeof globalThis.StorageEvent === 'undefined') {
		class StorageEventPolyfill extends Event {
			readonly key: string | null
			constructor(type: string, init?: { key?: string | null }) {
				super(type)
				this.key = init?.key ?? null
			}
		}
		Object.defineProperty(globalThis, 'StorageEvent', {
			configurable: true,
			value: StorageEventPolyfill,
		})
	}
	if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
		Object.defineProperty(globalThis, 'window', {
			configurable: true,
			value: new EventTarget(),
		})
	}
})

function dispatchStorage(key: string): void {
	window.dispatchEvent(new StorageEvent('storage', { key }))
}

describe('subscribeToStorageChanges', () => {
	it('notifies for watched keys and its custom event, then unsubscribes', () => {
		const onStoreChange = mock.fn(() => {})
		const unsubscribe = subscribeToStorageChanges(
			['progress', 'history'],
			'changed',
			onStoreChange,
		)

		dispatchStorage('other')
		dispatchStorage('progress')
		window.dispatchEvent(new Event('changed'))

		assert.equal(onStoreChange.mock.calls.length, 2)

		unsubscribe()
		dispatchStorage('history')
		window.dispatchEvent(new Event('changed'))

		assert.equal(onStoreChange.mock.calls.length, 2)
	})
})
