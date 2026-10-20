-- 旧回答・タイマー・認証データを、秘密リンクで同期する確認履歴へ置き換える。
-- 0004が旧Better Auth版・新進捗版のどちらで適用済みでも同じ最終状態に収束させる。

DROP TABLE IF EXISTS dashboard_shares;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS verification;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS question_progress;
DROP TABLE IF EXISTS sync_spaces;

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
