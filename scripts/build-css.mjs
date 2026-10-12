/**
 * `legacy/index.css`（Tailwind v4 依存）を Tailwind 非依存のプレーン CSS へ変換する。
 *
 * - `@import "tailwindcss"` / `@plugin ...` を除去
 * - `@apply <utilities>;` を、対応する宣言へ展開
 * - マークアップで使うユーティリティを末尾の compat ブロックで定義
 *
 * 使い方: node scripts/build-css.mjs
 * 出力: public/style.css（Worker が静的配信する）
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REM = (n) => `${n * 0.25}rem`

/** Tailwind ユーティリティ -> 素の CSS 宣言 */
const UTILITIES = {
	// display / layout
	flex: 'display:flex',
	'flex-col': 'flex-direction:column',
	'flex-wrap': 'flex-wrap:wrap',
	grid: 'display:grid',
	block: 'display:block',
	'inline-block': 'display:inline-block',
	'inline-flex': 'display:inline-flex',
	relative: 'position:relative',
	sticky: 'position:sticky',
	'top-0': 'top:0',
	'items-center': 'align-items:center',
	'items-start': 'align-items:flex-start',
	'justify-center': 'justify-content:center',
	'shrink-0': 'flex-shrink:0',
	'overflow-hidden': 'overflow:hidden',
	'overflow-x-auto': 'overflow-x:auto',
	'w-full': 'width:100%',
	'min-h-10': `min-height:${REM(10)}`,
	'min-h-11': `min-height:${REM(11)}`,
	'min-h-14': `min-height:${REM(14)}`,
	'border-collapse': 'border-collapse:collapse',
	'text-center': 'text-align:center',
	'text-left': 'text-align:left',
	'whitespace-nowrap': 'white-space:nowrap',
	'break-words': 'overflow-wrap:break-word',
	'cursor-pointer': 'cursor:pointer',
	'no-underline': 'text-decoration:none',
	'underline': 'text-decoration:underline',
	'hidden': 'display:none',
	'underline-offset-4': 'text-underline-offset:4px',
	'max-w-2xl': 'max-width:42rem',
	'max-w-3xl': 'max-width:48rem',

	// spacing
	'p-1': `padding:${REM(1)}`,
	'p-2': `padding:${REM(2)}`,
	'p-3': `padding:${REM(3)}`,
	'p-4': `padding:${REM(4)}`,
	'px-2': `padding-inline:${REM(2)}`,
	'px-3': `padding-inline:${REM(3)}`,
	'px-4': `padding-inline:${REM(4)}`,
	'px-5': `padding-inline:${REM(5)}`,
	'py-1.5': 'padding-block:0.375rem',
	'py-2': `padding-block:${REM(2)}`,
	'py-2.5': 'padding-block:0.625rem',
	'py-3': `padding-block:${REM(3)}`,
	'mt-2': `margin-top:${REM(2)}`,
	'mt-3': `margin-top:${REM(3)}`,
	'mt-4': `margin-top:${REM(4)}`,
	'mb-3': `margin-bottom:${REM(3)}`,
	'mb-4': `margin-bottom:${REM(4)}`,
	'my-4': `margin-block:${REM(4)}`,
	'gap-2': `gap:${REM(2)}`,
	'gap-3': `gap:${REM(3)}`,

	// sizing
	'h-4': `height:${REM(4)}`,
	'h-6': `height:${REM(6)}`,
	'h-7': `height:${REM(7)}`,
	'h-9': `height:${REM(9)}`,
	'w-1': `width:${REM(1)}`,
	'w-6': `width:${REM(6)}`,
	'w-7': `width:${REM(7)}`,
	'w-9': `width:${REM(9)}`,

	// typography
	'text-xs': 'font-size:0.75rem;line-height:1rem',
	'text-sm': 'font-size:0.875rem;line-height:1.25rem',
	'text-base': 'font-size:1rem;line-height:1.5rem',
	'text-lg': 'font-size:1.125rem;line-height:1.75rem',
	'text-2xl': 'font-size:1.5rem;line-height:2rem',
	'text-3xl': 'font-size:1.875rem;line-height:2.25rem',
	'text-4xl': 'font-size:2.25rem;line-height:2.5rem',
	'text-[15px]': 'font-size:15px',
	'leading-8': 'line-height:2rem',
	'leading-tight': 'line-height:1.25',
	'font-medium': 'font-weight:500',
	'font-semibold': 'font-weight:600',
	'font-bold': 'font-weight:700',
	'font-black': 'font-weight:900',
	'whitespace-pre-wrap': 'white-space:pre-wrap',

	// colors
	'bg-white': 'background-color:#ffffff',
	'bg-blue-50': 'background-color:#eff6ff',
	'bg-gray-50': 'background-color:#f9fafb',
	'bg-slate-50': 'background-color:#f8fafc',
	'bg-indigo-500': 'background-color:#6366f1',
	'border': 'border-width:1px;border-style:solid',
	'border-t': 'border-top-width:1px;border-top-style:solid',
	'border-l-2': 'border-left-width:2px;border-left-style:solid',
	'border-blue-200': 'border-color:#bfdbfe',
	'border-gray-200': 'border-color:#e5e7eb',
	'border-gray-300': 'border-color:#d1d5db',
	'border-gray-800': 'border-color:#1f2937',
	'border-indigo-200': 'border-color:#c7d2fe',
	'border-slate-200': 'border-color:#e2e8f0',
	'text-white': 'color:#ffffff',
	'text-black': 'color:#000000',
	'text-blue-800': 'color:#1e40af',
	'text-indigo-900': 'color:#312e81',
	'text-slate-300': 'color:#cbd5e1',
	'text-slate-500': 'color:#64748b',
	'text-slate-600': 'color:#475569',
	'text-slate-800': 'color:#1e293b',
	'text-gray-500': 'color:#6b7280',
	'text-gray-600': 'color:#4b5563',
	'text-gray-700': 'color:#374151',
	'text-amber-900': 'color:#78350f',
	'text-[#1e3a5f]': 'color:#1e3a5f',

	// effects
	'rounded': 'border-radius:0.25rem',
	'rounded-md': 'border-radius:0.375rem',
	'rounded-lg': 'border-radius:0.5rem',
	'rounded-xl': 'border-radius:0.75rem',
	'rounded-full': 'border-radius:9999px',
	'shadow-sm': 'box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.05)',
	'shadow-md': 'box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)',
	'transition-all': 'transition-property:all;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms',
	'transition-colors': 'transition-property:color,background-color,border-color,fill,stroke;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms',
	'transition-shadow': 'transition-property:box-shadow;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms',
	'sr-only':
		'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0',
}

/** space-y-* / hover:* / sm:* のような特殊形を宣言へ展開する */
function special(utility) {
	let match
	if ((match = utility.match(/^space-y-(\d+(?:\.\d+)?)$/))) {
		const value = REM(Number(match[1]))
		return `& > :not([hidden]) ~ :not([hidden]) { margin-top: ${value}; }`
	}
	if ((match = utility.match(/^hover:(.+)$/))) {
		const inner = UTILITIES[match[1]]
		return inner ? `&:hover { ${inner} }` : null
	}
	if ((match = utility.match(/^sm:(.+)$/))) {
		const inner = UTILITIES[match[1]]
		return inner ? `@media (min-width: 40rem) { ${inner} }` : null
	}
	return null
}

const source = readFileSync('legacy/index.css', 'utf8')

const withoutTailwind = source
	.replace(/^@import "tailwindcss";\s*$/m, '')
	.replace(/^@plugin "@tailwindcss\/typography";\s*$/m, '')

const missing = new Set()

const expanded = withoutTailwind.replace(/@apply ([^;]+);/g, (_full, list) => {
	const declarations = []
	for (const utility of String(list).trim().split(/\s+/)) {
		const declaration = UTILITIES[utility] ?? special(utility)
		if (declaration) {
			declarations.push(declaration)
		} else {
			missing.add(utility)
		}
	}
	return declarations.join(';').replace(/;?$/, ';')
})

if (missing.size > 0) {
	console.warn('unmapped @apply utilities:', [...missing].join(', '))
}

/** マークアップで class="..." として直接使うユーティリティを実クラスとして出力する。 */
function escapeClassName(name) {
	return name.replace(/[:.[\]/]/g, (char) => `\\${char}`)
}

function toCssClass(utility) {
	const declaration = UTILITIES[utility] ?? special(utility)
	if (!declaration) {
		return null
	}
	const selector = `.${escapeClassName(utility)}`
	// ネストした `&` を自身のセレクタへ展開する（hover:/sm: と space-y の子セレクタ）
	return `${selector} { ${declaration.replaceAll('&', selector)} }`
}

const compat = Object.keys(UTILITIES)
	.map(toCssClass)
	.filter(Boolean)
	.join('\n')

writeFileSync('public/style.css', `${expanded}\n\n/* compat utilities (Tailwind ユーティリティ相当) */\n${compat}\n`)
console.log('wrote public/style.css')
