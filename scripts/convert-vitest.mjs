/**
 * Vitest のテストを `remix test`（remix/test + remix/assert）へ機械変換する。
 *
 * 対応: describe/it、expect の主要マッチャ（toBe/toEqual/toStrictEqual/toHaveLength/
 * toMatch/toBeNull/not.toBeNull/not.toBe/toBeGreaterThan/toBeLessThan/toThrow/toContain/
 * toBeTruthy/toBeFalsy/toBeDefined/toBeUndefined）。
 * `vi.fn` / `vi.spyOn` を含むファイルは手動対応が必要なため、警告のみ出す。
 *
 * 使い方: node scripts/convert-vitest.mjs <file...>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)

function convert(source) {
	let s = source
	s = s.replace(
		/import\s*\{([^}]*)\}\s*from\s*["']vitest["'];?/,
		(_match, names) => {
			const hasVi = /\bvi\b/.test(names)
			const header = "import * as assert from 'remix/assert'\nimport { describe, it } from 'remix/test'"
			return hasVi ? `${header}\n// TODO: convert vi.* usage to ` + '`t.mock.*`' + `\n` : `${header}\n`
		},
	)

	const replacements = [
		[/expect\(([^;\n]+?)\)\.toStrictEqual\(([^;\n]+?)\);/g, 'assert.deepEqual($1, $2);'],
		[/expect\(([^;\n]+?)\)\.toEqual\(([^;\n]+?)\);/g, 'assert.deepEqual($1, $2);'],
		[/expect\(([^;\n]+?)\)\.toHaveLength\(([^;\n]+?)\);/g, 'assert.equal(($1).length, $2);'],
		[/expect\(([^;\n]+?)\)\.toBe\(([^;\n]+?)\);/g, 'assert.equal($1, $2);'],
		[/expect\(([^;\n]+?)\)\.not\.toBe\(([^;\n]+?)\);/g, 'assert.notEqual($1, $2);'],
		[/expect\(([^;\n]+?)\)\.not\.toBeNull\(\);/g, 'assert.ok($1 !== null);'],
		[/expect\(([^;\n]+?)\)\.toBeNull\(\);/g, 'assert.equal($1, null);'],
		[/expect\(([^;\n]+?)\)\.toBeGreaterThan\(([^;\n]+?)\);/g, 'assert.ok(($1) > ($2));'],
		[/expect\(([^;\n]+?)\)\.toBeGreaterThanOrEqual\(([^;\n]+?)\);/g, 'assert.ok(($1) >= ($2));'],
		[/expect\(([^;\n]+?)\)\.toBeLessThan\(([^;\n]+?)\);/g, 'assert.ok(($1) < ($2));'],
		[/expect\(([^;\n]+?)\)\.toMatch\(([^;\n]+?)\);/g, 'assert.match($1, $2);'],
		[/expect\(([^;\n]+?)\)\.toContain\(([^;\n]+?)\);/g, 'assert.ok(($1).includes($2));'],
		[/expect\(([^;\n]+?)\)\.toBeTruthy\(\);/g, 'assert.ok($1);'],
		[/expect\(([^;\n]+?)\)\.toBeFalsy\(\);/g, 'assert.ok(!($1));'],
		[/expect\(([^;\n]+?)\)\.toBeDefined\(\);/g, 'assert.ok(($1) !== undefined);'],
		[/expect\(([^;\n]+?)\)\.toBeUndefined\(\);/g, 'assert.equal($1, undefined);'],
		[/expect\(([^;\n]+?)\)\.toThrow\(\);/g, 'assert.throws(() => $1);'],
		[/expect\(([^;\n]+?)\)\.not\.toThrow\(\);/g, 'assert.doesNotThrow(() => $1);'],
	]

	for (const [pattern, replacement] of replacements) {
		s = s.replace(pattern, replacement)
	}

	return s
}

for (const file of files) {
	const source = readFileSync(file, 'utf8')
	const converted = convert(source)
	writeFileSync(file, converted)
	const leftover = (converted.match(/expect\(/g) ?? []).length
	const vi = (converted.match(/\bvi\./g) ?? []).length
	console.log(`${file}: converted, leftover expect=${leftover} vi=${vi}`)
}
