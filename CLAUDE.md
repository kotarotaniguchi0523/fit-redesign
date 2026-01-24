# プロジェクト開発ガイドライン

## サブエージェント活用方針

**原則**: タスクは積極的にサブエージェントに委譲する

---

### ビルトインエージェント

| エージェント | 用途 | 使用タイミング |
|-------------|------|---------------|
| `Explore` | コードベース探索 | ファイル検索、構造理解、コード調査時 |
| `Plan` | 実装計画設計 | 複雑な機能実装前の設計時 |
| `Bash` | コマンド実行 | git操作、ビルド、デプロイ等 |
| `general-purpose` | 汎用調査 | 複数ラウンドの検索が必要な調査時 |

### Taskmaster系

| エージェント | 用途 |
|-------------|------|
| `taskmaster:task-orchestrator` | タスク依存関係分析・並列実行調整 |
| `taskmaster:task-executor` | 個別タスクの実装実行 |
| `taskmaster:task-checker` | 実装完了タスクの品質検証 |

### Feature-dev系

| エージェント | 用途 |
|-------------|------|
| `feature-dev:code-architect` | 機能アーキテクチャ設計・実装ブループリント作成 |
| `feature-dev:code-explorer` | 既存コードの実行パス追跡・パターン分析 |
| `feature-dev:code-reviewer` | バグ・セキュリティ・品質のコードレビュー |

### その他

| エージェント | 用途 |
|-------------|------|
| `code-simplifier:code-simplifier` | コードの簡素化・リファクタリング |
| `context7-plugin:docs-researcher` | ライブラリドキュメント調査 |
| `claude-code-guide` | Claude Code自体の使い方質問 |

---

### インストール済みスキル（/コマンド）

| スキル | 用途 |
|--------|------|
| `/frontend-design` | 高品質フロントエンドUI作成 |
| `/agent-browser` | ブラウザ自動操作・テスト |
| `/docs` (context7) | ライブラリドキュメント参照 |

---

## 使い分けガイド

```
質問・調査系 → Explore / docs-researcher
設計・計画系 → Plan / code-architect
実装系 → task-executor / general-purpose
レビュー系 → code-reviewer / task-checker
リファクタ → code-simplifier
```

## 並列実行

独立したタスクは**必ず並列でサブエージェント起動**する

---

## スクリーンショット管理

**保存先**: `screenshots/` フォルダに必ず保存する

```bash
# 正しい例
agent-browser screenshot screenshots/feature-check.png

# 間違い（ルートに保存しない）
agent-browser screenshot feature-check.png
```

**命名規則**: `{機能名}-{状態}.png`（例: `answer-toggle.png`, `figure-check.png`）

---

## パッケージマネージャー

**pnpm を使用すること**（npm, yarn は禁止）

### コマンド一覧

```bash
pnpm dev        # 開発サーバー起動
pnpm build      # 本番ビルド（tsgo + vite build）
pnpm preview    # ビルド結果プレビュー
pnpm format     # Biome でフォーマット
pnpm typecheck  # 型チェック（tsgo --noEmit）
```
