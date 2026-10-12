/**
 * グローバルスタイルをビルドする。
 *
 * 方針（REARCHITECTURE.md §4）: グローバル CSS はデザイントークンと最小の base のみ。
 * コンポーネントの見た目は各コンポーネントの `css()` に併置するため、ここでは
 * `app/styles/global.css` を Workers Assets が配信する `public/style.css` へコピーする。
 *
 * 使い方: node scripts/build-css.mjs
 */
import { copyFileSync } from 'node:fs'

copyFileSync('app/styles/global.css', 'public/style.css')
console.log('wrote public/style.css (global tokens + base)')
