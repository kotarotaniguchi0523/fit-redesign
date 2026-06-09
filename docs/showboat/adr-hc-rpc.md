# ADR: クライアント通信を hono/client (hc) RPC へ再統一

- Status: Accepted
- Date: 2026-06-09

## Context

HonoX 移行時に、旧 Astro 期の `hc<ApiType>` 型クライアントを廃止し「クライアントは
`fetch("/...")` を直接呼ぶ」方針へ切り替えていた（理由: HonoX のファイルルートは
per-endpoint に分解され、hc が要求する単一の chained `AppType` を素直に出さなかったため）。

その結果、クライアント通信（`app/features/answer/answerClient.ts`・
`app/features/timer/timerSync.ts`）は raw `fetch` + 手書きのレスポンス整形・型ガードに
なっており、サーバーのリクエスト/レスポンス型と乖離しても型エラーで気づけなかった。

## Decision

全クライアント通信を hono/client (hc) RPC に再統一する。

- API を機能ごとの **chained Hono sub-app** に集約し、`app/routes/` 直下へ
  `export default` する（`answer.ts`→`/answer`、`timer.ts`→`/timer`）。`markdown.ts` が
  既に同じパターン（default-export Hono を filename パスへマウント）で本番稼働している。
- 各 sub-app は `export type XxxApp = typeof app` を出す。
- クライアントは `hc<XxxApp>("/xxx")` を生成し `client.status.$get({ query })` /
  `client.submit.$post({ json })` で型安全に呼ぶ。**型は `import type` で取り込む**ため
  zod スキーマ等の server コードはクライアントバンドルに混入せず、hc ランタイムのみ載る。
- health 等の単発エンドポイントはクライアント非経由のため `_lib.ts` の `apiRoute`
  （型付き createRoute）のままでよい。

## Consequences

- リクエスト/レスポンス型がサーバー定義（zValidator スキーマ + `c.json`）から推論され、
  クライアントとサーバーの型乖離がコンパイル時に検出される。
- per-endpoint ファイル（`answer/{submit,status,history}.ts`・`timer/{sync,load,clear}.ts`）は
  chained sub-app へ統合し削除。`api.honox.test.ts` は sub-app の route マウントで再現。
- 旧 ADR「fetch 直接・hc 廃止」は撤回。

## Verification

- `pnpm typecheck:full` 緑（hc 型推論成立）。
- `app/api.honox.test.ts` 17 件緑（外部 URL・400/413/304・middleware ヘッダ）。
- 本番相当（`pnpm build` → `pnpm preview` = wrangler dev）で実測:
  - `/answer/status` `/answer/history` `/timer/load` → 200、`/answer/status`（userId 無）→ 400
  - `POST /timer/sync` → 200、`POST /answer/submit` → 200（実 D1 insert）、`DELETE /timer/clear` → 200
  - ページルート `/` `/unit-base-conversion/2015` `/today/...` `/markdown` → 全 200（sub-app と衝突なし）
  - client チャンクに肥大化なし（zod は import type で server 側に留まる）。
