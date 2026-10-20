-- 匿名回答・タイマー記録を、秘密リンクで同期する確認履歴へ置き換える。
-- このマイグレーションは未適用の0004を新仕様へ差し替えるもの。

DROP TABLE IF EXISTS dashboard_shares;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS "user";

CREATE TABLE sync_spaces (
  id         TEXT    NOT NULL PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE question_progress (
  sync_space_id TEXT    NOT NULL,
  question_id   TEXT    NOT NULL,
  unit_id       TEXT    NOT NULL,
  revealed_at   INTEGER NOT NULL,
  PRIMARY KEY (sync_space_id, question_id),
  FOREIGN KEY (sync_space_id) REFERENCES sync_spaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_question_progress_recent
  ON question_progress(sync_space_id, revealed_at DESC);
