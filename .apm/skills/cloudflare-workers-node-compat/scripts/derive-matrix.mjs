/**
 * Cloudflare Workers の Node.js 互換マトリクスを @cloudflare/unenv-preset から導出する。
 *
 * 使い方:
 *   node scripts/derive-matrix.mjs
 *
 * 出力: 各 node:* モジュールがネイティブになる compatibility_date と必須フラグ。
 * 解釈: compatibilityDate >= "native since" なら workerd のネイティブ実装。
 *       それ未満は unenv ポリフィル（多くは notImplemented を投げる）。
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const presetPkg = require.resolve('@cloudflare/unenv-preset/package.json')
const presetDir = presetPkg.replace(/\/package\.json$/, '')
const source = readFileSync(`${presetDir}/dist/index.mjs`, 'utf8')

const version = JSON.parse(readFileSync(presetPkg, 'utf8')).version

const chunks = source.split(/\nfunction get/).slice(1)
const rows = []

for (const chunk of chunks) {
	const name = chunk.slice(0, chunk.indexOf('('))
	const end = chunk.indexOf('\nfunction ')
	const body = end === -1 ? chunk : chunk.slice(0, end)

	const dates = [
		...new Set([...body.matchAll(/>=\s*"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1])),
	]
	const flags = [
		...new Set(
			[...body.matchAll(/includes\("(enable_[a-z0-9_]+)"\)/g)].map((m) => m[1]),
		),
	]
	const list = (key) => [
		...new Set(
			[...body.matchAll(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`, 'g'))].flatMap((m) =>
				m[1]
					.split(',')
					.map((s) => s.replace(/["'`\s]/g, ''))
					.filter((s) => s && !s.startsWith('//')),
			),
		),
	]

	rows.push({
		name: name.replace('Overrides', ''),
		date: dates[0] ?? '',
		flag: flags[0] ?? '',
		native: list('nativeModules'),
		hybrid: list('hybridModules'),
	})
}

console.log(`@cloudflare/unenv-preset v${version}\n`)
console.log('module             native since   required flag                     modules')
console.log('-----------------  -------------  --------------------------------  -------')
for (const row of rows.filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date))) {
	console.log(
		`${row.name.padEnd(17)}  ${row.date.padEnd(13)}  ${(row.flag || '-').padEnd(32)}  ${row.native.join(' ')}`,
	)
}

const neverNative = rows.filter((r) => !r.date)
if (neverNative.length > 0) {
	console.log('\nno date gate:')
	for (const row of neverNative) console.log(`  ${row.name}: ${row.native.join(' ') || '(none)'}`)
}

// 実行時ポリフィル（inject）の一覧。ネイティブでない部分を補う最小セット。
const { getCloudflarePreset } = await import('@cloudflare/unenv-preset')
const preset = getCloudflarePreset({
	compatibilityDate: process.env.COMPAT_DATE ?? '2026-10-06',
	compatibilityFlags: ['nodejs_compat'],
})
console.log('\ninjected polyfills (compat',
	process.env.COMPAT_DATE ?? '2026-10-06',
	'):',
	Object.keys(preset.inject ?? {}).sort().join(', '),
)
