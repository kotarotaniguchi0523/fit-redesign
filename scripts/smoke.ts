/**
 * SSR スモークテスト。Node 上で Remix ルーターを直接呼び、HTML を検証する。
 * 実行: node --import remix/node-tsx scripts/smoke.ts
 */
import { router } from '../app/router.ts'

const checks: Array<{ name: string; run: () => Promise<void> }> = []

function check(name: string, run: () => Promise<void>) {
	checks.push({ name, run })
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message)
	}
}

check('GET / が SSR され、単元が並ぶ', async () => {
	const response = await router.fetch(new Request('http://localhost/'))
	assert(response.status === 200, `status ${response.status}`)
	const html = await response.text()
	assert(html.includes('FIT Redesign'), 'title missing')
	assert(html.includes('基数変換'), 'unit missing')
	assert(html.includes('unit-base-conversion'), 'unit link missing')
	assert(
		response.headers.get('content-security-policy')?.includes("default-src 'self'"),
		'CSP header missing',
	)
})

check('GET /health が JSON を返す', async () => {
	const response = await router.fetch(new Request('http://localhost/health'))
	assert(response.status === 200, `status ${response.status}`)
	const body = (await response.json()) as { status?: string }
	assert(body.status === 'ok', 'health body mismatch')
})

check('GET /:unit/:year が 200 を返す', async () => {
	const response = await router.fetch(new Request('http://localhost/unit-base-conversion/2017'))
	assert(response.status === 200, `status ${response.status}`)
	const html = await response.text()
	assert(html.includes('unavailable') === false, 'unexpected content')
})

check('未知のパスは 404', async () => {
	const response = await router.fetch(new Request('http://localhost/definitely-not-a-route'))
	assert(response.status === 404, `status ${response.status}`)
})

let failures = 0
for (const { name, run } of checks) {
	try {
		await run()
		console.log(`ok   - ${name}`)
	} catch (error) {
		failures++
		console.error(`FAIL - ${name}`)
		console.error(`       ${(error as Error).message}`)
	}
}

console.log(`\n${checks.length - failures}/${checks.length} passed`)
if (failures > 0) {
	process.exitCode = 1
}
