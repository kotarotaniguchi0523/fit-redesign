# リポジトリ案内

## プロジェクト

情報処理技術者試験の問題・解答・学習記録を提供するWebアプリ。Cloudflare Workers上でHonoX/Honoを動かし、パッケージ管理にはpnpmを使う。

## 主な配置

- `app/routes/`: HonoXのページ/APIルート
- `app/features/`: 機能単位のUI・ドメインロジック・状態管理
- `app/components/`: 複数機能で使う共有Hono JSX
- `app/server/`: Worker側のDBアクセスなどサーバー処理
- `app/data/`: 単元・試験データ。試験問題JSONは`app/data/exams-json/`、検証スキーマは`app/data/exams/schema.ts`
- `app/lib/`: 機能に依存しない共有処理
- `migrations/`: Cloudflare D1のSQLマイグレーション

## 実装時の方針

- 変更前に関係する実装とテストを確認し、既存の構成・命名に合わせて必要な範囲だけ変更する。
- 機能固有の処理はその機能内に置く。複数箇所で実際に共有される処理だけを共有領域へ移す。
- ドメイン処理は可能な限り副作用のない関数にし、I/O・DB・ブラウザーAPIなどの副作用は境界に寄せる。
- API入力や保存済みデータなど、信頼できない値は既存のスキーマ・検証方法で検証する。
- DBスキーマを変更するときはDrizzle定義とマイグレーションを揃え、生成SQLを確認する。同期キーなどの秘密値をログやエラー応答へ出さない。
- 画面はサーバー描画を基本とし、ブラウザーでの操作が必要な箇所に既存のHonoX islandパターンを使う。
- アーキテクチャやドメイン上の不変条件は`lat.md/`へ記録し、実装を変えたら該当する知識とテスト仕様も更新する。実装を丸ごと複製せず、参照で結ぶ。

## よく使うコマンド

- `pnpm dev`: 開発サーバー
- `pnpm build`: クライアントとWorkerをビルド
- `pnpm check`: Biomeの検査
- `pnpm lat:lint`: lat.mdのリンクとコード参照を検査
- `pnpm lint`: Biomeとlat.mdの検査
- `pnpm typecheck:full`: TypeScript型検査
- `pnpm test:run`: Vitestを一度実行
- `pnpm e2e`: ビルド後にPlaywrightを実行
- `pnpm db:check`: Drizzleマイグレーションの整合性を検査

## 検証

変更に近いテストを実行し、変更内容に応じて型検査・ビルド・E2Eを追加する。広い変更では関連する全体チェックも行う。コードや知識グラフを変更したら`pnpm lint`を実行する。ドキュメントだけの変更では、他のコード用チェックを一律に実行する必要はない。

%% lat:begin %%
# Before starting work

- Run `pnpm exec lat search` to find sections relevant to your task. Read them to understand the design intent before writing code.
- Run `pnpm exec lat expand` on user prompts containing `[[refs]]` to resolve those section names to file locations.

# Post-task checklist (REQUIRED — do not skip)

After EVERY task, before responding to the user:

- [ ] Update `lat.md/` if you added or changed any functionality, architecture, tests, or behavior
- [ ] Run `pnpm lat:lint` — all wiki links and code refs must pass
- [ ] Do not skip these steps. Do not consider your task done until both are complete.

---

# What is lat.md?

This project uses [lat.md](https://www.npmjs.com/package/lat.md) to maintain a structured knowledge graph of its architecture, design decisions, and test specs in the `lat.md/` directory. It is a set of cross-linked markdown files that describe **what** this project does and **why** — the domain concepts, key design decisions, business logic, and test specifications. Use it to ground your work in the actual architecture rather than guessing.

# Commands

```bash
pnpm exec lat locate "Section Name"      # find a section by name (exact, fuzzy)
pnpm exec lat refs "file#Section"        # find what references a section
pnpm exec lat search "natural language"  # semantic search across all sections
pnpm exec lat expand "user prompt text"  # expand [[refs]] to resolved locations
pnpm lat:lint                              # run lat check and validate links/code refs
```

Run `pnpm exec lat --help` when in doubt about available commands or options.

Semantic search uses the bundled local model and works without an API key. Use `pnpm exec lat locate` for exact section-name lookup.

# Syntax primer

- **Section ids**: `lat.md/path/to/file#Heading#SubHeading` — full form uses project-root-relative path (e.g. `lat.md/tests/search#RAG Replay Tests`). Short form uses bare file name when unique (e.g. `search#RAG Replay Tests`, `cli#search#Indexing`).
- **Wiki links**: `[[target]]` or `[[target|alias]]` — cross-references between sections. Can also reference source code: `[[src/foo.ts#myFunction]]`.
- **Source code links**: Wiki links in `lat.md/` files can reference functions, classes, constants, and methods in TypeScript/JavaScript/Python/Rust/Go/C files. Use the full path: `[[src/config.ts#getConfigDir]]`, `[[src/server.ts#App#listen]]` (class method), `[[lib/utils.py#parse_args]]`, `[[src/lib.rs#Greeter#greet]]` (Rust impl method), `[[src/app.go#Greeter#Greet]]` (Go method), `[[src/app.h#Greeter]]` (C struct). `pnpm lat:lint` validates these targets.
- **Code refs**: `// @lat: [[section-id]]` (JS/TS/Rust/Go/C) or `# @lat: [[section-id]]` (Python) — ties source code to concepts

# Test specs

Key tests can be described as sections in `lat.md/` files (e.g. `tests.md`). Add frontmatter to require that every leaf section is referenced by a `// @lat:` or `# @lat:` comment in test code:

```markdown
---
lat:
  require-code-mention: true
---
# Tests

Authentication and authorization test specifications.

## User login

Verify credential validation and error handling for the login endpoint.

### Rejects expired tokens
Tokens past their expiry timestamp are rejected with 401, even if otherwise valid.

### Handles missing password
Login request without a password field returns 400 with a descriptive error.
```

Every section MUST have a description — at least one sentence explaining what the test verifies and why. Empty sections with just a heading are not acceptable. (This is a specific case of the general leading paragraph rule below.)

Each test in code should reference its spec with exactly one comment placed next to the relevant test — not at the top of the file:

```python
# @lat: [[tests#User login#Rejects expired tokens]]
def test_rejects_expired_tokens():
    ...

# @lat: [[tests#User login#Handles missing password]]
def test_handles_missing_password():
    ...
```

Do not duplicate refs. One `@lat:` comment per spec section, placed at the test that covers it. `lat check` will flag any spec section not covered by a code reference, and any code reference pointing to a nonexistent section.

# Section structure

Every section in `lat.md/` **must** have a leading paragraph — at least one sentence immediately after the heading, before any child headings or other block content. The first paragraph must be ≤250 characters (excluding `[[wiki link]]` content). This paragraph serves as the section's overview and is used in search results, command output, and RAG context — keeping it concise guarantees the section's essence is always captured.

```markdown
# Good Section

Brief overview of what this section documents and why it matters.

More detail can go in subsequent paragraphs, code blocks, or lists.

## Child heading

Details about this child topic.
```

```markdown
# Bad Section

## Child heading

Details about this child topic.
```

The second example is invalid because `Bad Section` has no leading paragraph. `pnpm lat:lint` validates this rule and reports errors for missing or overly long leading paragraphs.
%% lat:end %%
