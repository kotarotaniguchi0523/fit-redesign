/**
 * ブラウザー入口の公開 URL。
 *
 * `clientEntry()` の ID と Document の module script が同じ値を使う。
 * 実体は `scripts/build-assets.mjs` が Remix のアセットサーバーで
 * `app/actions/public/entry.ts` をコンパイルして `public/` へ出力したもの。
 */
export const CLIENT_ENTRY_HREF = "/assets/app/actions/public/entry.ts";
