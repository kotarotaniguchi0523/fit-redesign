/**
 * `remix test` は Node 上で動くため、ブラウザー API を使うモジュールのテスト向けに
 * 最小限のシムを用意する。テストファイルの先頭で `installBrowserShims()` を呼ぶ。
 */
type Global = typeof globalThis & Record<string, unknown>

export function installBrowserShims(): void {
	const global = globalThis as Global

	if (typeof global.localStorage === 'undefined') {
		const store = new Map<string, string>()
		Object.defineProperty(global, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
				setItem: (key: string, value: string) => void store.set(key, String(value)),
				removeItem: (key: string) => void store.delete(key),
				clear: () => store.clear(),
				key: (index: number) => [...store.keys()][index] ?? null,
				get length() {
					return store.size
				},
			},
		})
	}

	if (typeof global.StorageEvent === 'undefined') {
		class StorageEventPolyfill extends Event {
			readonly key: string | null
			constructor(type: string, init?: { key?: string | null }) {
				super(type)
				this.key = init?.key ?? null
			}
		}
		Object.defineProperty(global, 'StorageEvent', {
			configurable: true,
			value: StorageEventPolyfill,
		})
	}

	if (typeof global.window === 'undefined') {
		const target = new EventTarget() as EventTarget & Record<string, unknown>
		target.location = { href: 'http://localhost/' }
		target.history = { replaceState: () => {}, pushState: () => {} }
		Object.defineProperty(global, 'window', { configurable: true, value: target })
	}

	if (typeof global.location === 'undefined') {
		Object.defineProperty(global, 'location', {
			configurable: true,
			value: { href: 'http://localhost/', origin: 'http://localhost', search: '' },
		})
	}
}
