-- 初期スキーマ。過去の履歴は破棄し、現行の学習記録同期モデルを単一の初期マイグレーションとして定義する。
-- 変更する場合は本ファイルを編集せず、新しい番号のマイグレーションを追加する。

CREATE TABLE sync_links (
  id         TEXT    NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE question_progress (
  sync_link_id TEXT    NOT NULL,
  question_id  TEXT    NOT NULL,
  unit_id      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (sync_link_id, question_id),
  FOREIGN KEY (sync_link_id) REFERENCES sync_links(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);

CREATE INDEX idx_question_progress_recent
  ON question_progress(sync_link_id, updated_at DESC);

CREATE TABLE challenges (
  id           TEXT    NOT NULL PRIMARY KEY,
  sync_link_id TEXT    NOT NULL,
  exam_id      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (sync_link_id) REFERENCES sync_links(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);

CREATE INDEX idx_challenges_scope
  ON challenges(sync_link_id, exam_id, updated_at DESC);

CREATE INDEX idx_challenges_recent
  ON challenges(sync_link_id, updated_at);

CREATE TABLE answers (
  challenge_id TEXT    NOT NULL,
  question_id  TEXT    NOT NULL,
  elapsed_ms   INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  judgment     TEXT    NOT NULL CHECK (judgment IN ('correct', 'incorrect')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, question_id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  CHECK (created_at <= updated_at)
);
