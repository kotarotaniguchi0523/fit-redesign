# ADR: D1 スキーマの再設計（正規化 + Kysely 化）

- Status: Accepted（設計確定。実装はこれから）
- Date: 2026-06-09

## Context

D1 スキーマを正しく正規化し直すための検討記録。きっかけは 3 つ。

- userId 識別をクライアント送信からサーバー由来（cookie）へ移行した。
- migration `0003` のデプロイで `d1_migrations` 追跡の不整合が露呈した。
- スキーマを「ちゃんと正規化したい」という方針が出た。

各テーブルの Role をデータフロー実測で洗い出し、本質的に何を記録すべきかを議論して決定した。

## 決定（最終）

| 項目 | 決定 |
|---|---|
| migration | 旧 0001/0002/0003 を破棄し、単一 `0001_baseline.sql` に統合。wrangler で適用 |
| 実 DB | 全 drop してよい（本番だが未運用のため） |
| users | 残す。ただし `id` + `created_at` のみ（`last_seen_at` 廃止） |
| attempts | **廃止**。サーバー同期は未使用のため、タイマーは localStorage 専用にする |
| answers | `timestamp` 廃止。サーバー時刻 `created_at` を時系列の基準にする |
| questions | **新設**。surrogate `id` + `json_id`。静的 JSON の 210 問を seed |
| 整合性 | answers は登録済み question しか記録できない（未登録は記録不可） |
| identity | 素の UUID cookie（署名なし）。users は発行済み identity の登録簿 |
| query 層 | **Drizzle ORM をクエリビルダとしてのみ**使う（`drizzle-orm/d1`）。drizzle-kit / Atlas は使わず migration は wrangler 単一 baseline |

## 各テーブルの Role（大前提）

実際の読み書きから確定した役割。これが正規化の土台。

| テーブル | Role | 備考 |
|---|---|---|
| users | 発行済み匿名 identity の登録簿（cookie UUID） | FK 整合性のため。`created_at` のみ保持 |
| questions | 問題マスタ（JSON の問題 id を登録） | answers の参照先。未登録は記録不可の門番 |
| answers | 採点済み解答（append-only の学習記録） | dashboard / status が読む唯一の分析ソース。`is_correct` が中核シグナル |

廃止する attempts は「タイマー計測の localStorage ミラー（端末間同期用）」で、分析からは読まれていなかった。サーバーに残す価値が無いため落とす。

## 確定スキーマ（単一 baseline）

```sql
-- migrations/0001_baseline.sql（旧 0001/0002/0003 を統合）

-- 発行済み匿名 identity の登録簿（id は cookie UUID）
CREATE TABLE users (
  id         TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- 問題マスタ（静的 JSON から 210 問を seed）
CREATE TABLE questions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  json_id TEXT    NOT NULL UNIQUE          -- 例: exam1-2013-q1
);

-- 採点済み解答（1行 = 1回答。append-only）
CREATE TABLE answers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL REFERENCES users(id),
  question_id    INTEGER NOT NULL REFERENCES questions(id),
  selected_label TEXT    NOT NULL,
  is_correct     INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  duration       INTEGER          CHECK (duration IS NULL OR duration >= 0),
  created_at     INTEGER NOT NULL                              -- server Date.now()(ms)。月次集計/順序の基準
);
CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);
CREATE INDEX idx_answers_user_created  ON answers(user_id, created_at);

INSERT INTO questions (json_id) VALUES ('exam1-2013-q1'), /* … */ ;  -- 210 行（JSON から生成）
```

## questions の整合性（未登録は記録不可）

insert を json_id 解決つきにすることで、FK pragma の有無に関わらず門番が成立する。

```sql
INSERT INTO answers (user_id, question_id, selected_label, is_correct, duration, created_at)
SELECT ?, q.id, ?, ?, ?, ?
FROM questions q
WHERE q.json_id = ?;
```

- 未登録 json_id は 0 行挿入になり、記録されない。
- Kysely でも `insertInto(...).expression(...)` で同等に表現する。

## identity（認証不要）

- 素の UUID cookie を維持する（httpOnly, Secure, SameSite=Lax）。
- 発行は初回サイト訪問の 1 箇所のみ（`ensureUserIdentity`）。
- 認証ゼロで消えない匿名 identity は原理的に不可能なので、cookie を消せば別人になる前提を受け入れる。
- 脅威モデル上それで十分。
  - UUID は 122bit ランダムで推測不能。
  - 学習記録に機微情報が無い。
- 将来ハードニングするなら HMAC 署名を「発行時に付与・読み取り毎に検証」で足せる（no-auth のまま偽装耐性）。

## query 層: Drizzle ORM（クエリのみ。migration は wrangler）

- repositories の生 `db.prepare().bind().all()` を Drizzle のクエリに置換する。
- D1 接続は **公式 first-class アダプタ** `drizzle-orm/d1` を使う（活発に保守。未保守問題・自前 driver 不要）。
  - `import { drizzle } from "drizzle-orm/d1"` → `const db = drizzle(env.DB, { schema })`。
- **drizzle-kit は使わない**。migration は決定済みの wrangler 単一 baseline のまま（第2の台帳を作らない）。
- Drizzle スキーマ（`sqliteTable`）は query 型付けの源として手書きし、wrangler の baseline SQL と一致させる。
  - 生成器を使わないため両者は手動同期（3 テーブルで管理可能）。
  - drift 検知に、ローカル D1 へ baseline 適用 → 各クエリ実行の integration テストを置く。
- server 側のみに load（client バンドル非影響）。
- 不採用の選択肢。
  - kysely + `kysely-d1`: community D1 dialect が長期未保守のため。
  - 自前 Kysely D1 driver: driver を自前保守するより公式アダプタの Drizzle が安全。
  - Atlas / drizzle-kit: D1 へ直接適用できず台帳が二重化するため。適用は wrangler 一本。

## Hono + Drizzle 結線（Context7 で検証済み）

公式ドキュメントで確認したパターン。

- db インスタンスは**リクエスト毎**に作る（Workers の `env.DB` はリクエストスコープ）。
  - `import { drizzle } from "drizzle-orm/d1"` → `drizzle(c.env.DB, { schema })`。
  - 結線は server.ts middleware で `c.set("db", drizzle(c.env.DB, { schema }))`（既存の `c.var.userId` と同じ流儀）。repos は db を引数で受ける（テスト容易性）。
- schema は `drizzle-orm/sqlite-core` の `sqliteTable` で定義する。
  - `integer().primaryKey({ autoIncrement: true })` / `text().notNull()` / `.unique()` / `.references(() => questions.id)`。
  - CHECK は extra-config 配列で `check("name", sql\`${t.col} IN (0,1)\`)`。
  - 型は `typeof answers.$inferInsert` / `$inferSelect`。
- 「未登録 question は記録不可」は **insert from select** で表現する。
  - `db.insert(answers).select(db.select({ ... , questionId: questions.id }).from(questions).where(eq(questions.jsonId, jsonId)))`。
  - 未登録 jsonId は select が 0 行 → 0 行挿入。`.returning({ id: answers.id })` で id を取得。
- read で json_id を返すのは `leftJoin` で行う。
  - `db.select({ ... }).from(answers).leftJoin(questions, eq(answers.questionId, questions.id)).where(eq(answers.userId, userId))`。

### テスト方針の変更

- 現状の fake-D1 ユニットテストは Drizzle には合わない。
- **better-sqlite3 は使わない**。代わりに `@cloudflare/vitest-pool-workers`（Miniflare の実 D1）で integration テストする。
  - 実 D1 で CHECK / FK / insert-from-select の挙動をそのまま検証でき、Drizzle スキーマと baseline SQL の drift も検知できる。
  - jsdom の island テストとは vitest の projects/workspace で分離する。
- 最終構成は T12 で確定する。

## 廃止するもの

| 対象 | 理由 |
|---|---|
| attempts テーブル | サーバー同期未使用。タイマーは localStorage 専用へ |
| timerRepository / `/timer/*` ルート / timerSync / TimerApp(hc) | 上記に伴い不要 |
| answers.timestamp | client 時刻。server の `created_at` に一本化 |
| users.last_seen_at | 未読のバックキーピング |

## 実装順序

1. 依存追加（`pnpm add drizzle-orm`。drizzle-kit は入れない）。
2. Drizzle スキーマ（`sqliteTable`）+ db ファクトリ（`drizzle(env.DB)`）を `app/server/` に定義する。
3. `migrations/` を単一 `0001_baseline.sql` へ差し替える（schema + questions seed）。
4. questions seed を静的 JSON から生成する（exams-json → 210 INSERT）。
5. repositories を Kysely で書き直す。
   - answerRepository は insert を json_id 解決つきに、read は questions join で json_id を返す。
   - userRepository は id+created_at のみ upsert。
   - timer 系（repository / route / sync / hc）を削除する。
6. answer ルートと answerClient から `timestamp` を外し、`created_at` はサーバーで付与する。
7. dashboardAggregator の月次・順序を `created_at`(ms) に変える。
8. types / `_schemas.ts` を新形に合わせる（timestamp 除去、timer schema 削除）。
9. タイマー island を localStorage 専用にする。
10. テストを新スキーマに合わせて更新する。
11. ゲート（typecheck / biome / knip / tests / build）を通す。
12. 本番リセット後にデプロイする。

## 本番・デプロイの現状と再ベース手順（resume 時の注意）

- 本番は新コード（cookie identity / hc RPC / 宣言的 island）が稼働中。
- migration `0003` は本番未適用。
  - 本番 D1 は手動 bootstrap で `d1_migrations` 追跡が空。
  - wrangler が 0001 から全 migration を再適用しようとし `users already exists` で失敗する。
- CI トークンには D1:Edit を追加済み（`7403` 解消）。
- `Apply D1 migrations` は無条件実行に変更済み（`deploy.yml`、冪等）。
- 再ベース手順。
  - 本番の users/attempts/answers/`d1_migrations` を drop する（要 remote 権限）。
  - 新 baseline をコミットし push する。
  - CI が clean baseline を適用してデプロイする。
